import z from "zod";
import { API, APIError, HTTPHandler } from "core";
import { APISchema } from "../components/api_schema";
import { DB_CLIENT, REDIS_CLIENT } from "../..";
import { SQLTransaction } from "../../sql/sql_transaction";
import { StageStatus } from "./components/stage_status";
import { Payment } from "../components/payment";
import { Notification } from "../components/notification";
import { User } from "../components/user";

/** 주어진 데이터를 기반으로 토스페이먼츠 측 결제를 시도합니다. */
async function confirm(data: {
    paymentKey: string;
    orderId: string;
    amount: number;
}) {
    try {
        return await Payment.confirm(data);
    } catch (error) {
        throw StageMoverPaymentConfirmError.INVALID_PAYMENT;
    }
}

/** 서버 측에서 정의한 이사 절차의 결제 정보에 대한 데이터 형태. */
export const MoverStageOrder = z.object({
    requestId: APISchema.uuid,
    amount: z.number().min(0)
});

export const StageMoverPaymentConfirmRequest = z.object({
    paymentKey: z.string(),
    orderId: APISchema.uuid,
    amount: z.number().min(0)
});

class StageMoverPaymentConfirmError {
    /** 이미 만료되었거나 유효하지 않은 토스페이먼츠 결제 요청일 때. */
    static INVALID_PAYMENT = new APIError("INVALID_PAYMENT", 400);

    /** 사용자가 주장하는 결제 금액이 실제로 API 서버 또는 토스페이먼츠 측에서 정의한 결제 금액과 다를 때. */
    static INVALID_PAYMENT_AMOUNT = new APIError("INVALID_PAYMENT_AMOUNT", 400);
}

// stage/mover/payment/confirm
export const STAGE_MOVER_PAYMENT_CONFIRM_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(StageMoverPaymentConfirmRequest, body);

        const rawInfo = await REDIS_CLIENT.hGet("MoverStageOrder", given.orderId);

        // 유효하지 않은 주문 번호(orderId)의 UUID인 경우.
        if (!rawInfo) throw APIError.INVALID_UUID;

        const info = API.tryParseJSON(MoverStageOrder, rawInfo);

        // 사용자가 주장하는 결제 금액이 실제로 서버에서 정의한 결제 금액과 다른 경우.
        if (info.amount != given.amount) {
            throw StageMoverPaymentConfirmError.INVALID_PAYMENT_AMOUNT;
        }

        const [moverRequest] = await DB_CLIENT.query(
            "SELECT id, stageId, moverId FROM MoverRequest WHERE id = ?",
            [info.requestId]
        );

        const result = await confirm(given);
        const uuid = API.createUUID();

        // 사용자가 주장하는 결제 금액과 실제로 토스페이먼츠 측에서 결제된 금액과 다른 경우.
        if (result.data.totalAmount != given.amount) {
            // TODO: 추후 로그 남겨야 할듯싶음.
            // throw StageMoverPaymentConfirmError.INVALID_PAYMENT_AMOUNT;
        }

        // 이제 결제 처리가 완료되었기 때문에 관련 UUID를 만료시킵니다.
        await REDIS_CLIENT.hDel("MoverStageOrder", given.orderId);

        await SQLTransaction.perform(async (db) => {
            await db.query(
                "INSERT INTO MoverStage(id, stageId, requestId, paymentKey) VALUES(?, ?, ?, ?)",
                [uuid, moverRequest.stageId, moverRequest.id, given.paymentKey]
            );

            await db.query(
                "UPDATE Stage SET status = ? WHERE id = ?",
                [StageStatus.requestAccepted, moverRequest.stageId]
            );
        });

        // 사용자가 이사 업체의 제안을 수락하고 결제하였다는 사실을 이사 업체에게 알림.
        (async () => {
            const [stage] = await DB_CLIENT.query(
                "SELECT userId FROM Stage WHERE id = ? LIMIT 1",
                [moverRequest.stageId]
            );

            // 해당 이사 절차에 대한 사용자 이름.
            const displayName = await User.displayNameOf(stage.userId);

            const data = JSON.stringify({
                stageId: moverRequest.stageId,
                requestId: info.requestId,
            });

            await Notification.sendTo(moverRequest.moverId, {
                type: "requestAccepted",
                data: data,
                body: {
                    title: `${displayName}님이 당신의 제안을 수락했어요`,
                    body: "정확한 이사 날짜를 조율하고 절차가 완료되면 금액이 정산됩니다.",
                }
            });
        })().catch(() => null);

        API.success(response, {uuid});
    }
});