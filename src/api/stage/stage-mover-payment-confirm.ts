import { API, APIError, HTTPHandler } from "core";
import z from "zod";
import { APISchema } from "../components/api_schema";
import { config } from "dotenv";
import axios from "axios";
import { DB_CLIENT, REDIS_CLIENT } from "../..";
import { SQLTransaction } from "../../sql/sql_transaction";
import { StageStatus } from "./components/stage_status";

config();

/** 토스페이먼츠 API에 대한 시크릿 키. */
const secretKey = process.env.TOSS_SECRET_KEY;

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

/** 주어진 데이터를 기반으로 토스페이먼츠 측 결제를 시도합니다. */
async function confirm(data: {
    paymentKey: string;
    orderId: string;
    amount: number;
}) {
    const encryptedSecretKey =
        `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

    try {
        return await axios.post(
            "https://api.tosspayments.com/v1/payments/confirm", data, {
            headers: {
                Authorization: encryptedSecretKey,
                "Content-Type": "application/json"
            }
        });
    } catch (error) {
        throw StageMoverPaymentConfirmError.INVALID_PAYMENT;
    }
}

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

        const [row] = await DB_CLIENT.query(
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
                "INSERT INTO MoverStage(id, stageId, requestId) VALUES(?, ?, ?)",
                [uuid, row.stageId, row.id]
            );

            await db.query(
                "UPDATE Stage SET status = ? WHERE id = ?",
                [StageStatus.requestAccepted, row.stageId]
            );
        });

        API.success(response, {uuid});
    }
});