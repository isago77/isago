import { API, APIError, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import z from "zod";
import { APISchema } from "../components/api_schema";
import { DB_CLIENT, REDIS_CLIENT } from "../..";

export const StageMoverPaymentRequest = z.object({
    requestId: APISchema.uuid,
});

class StageMoverPaymentError {
    /** 해당 상품을 결제해야 하는 대상이 아닐 때. */
    static INVALID_PAYMENT_TARGET = new APIError("INVALID_PAYMENT_TARGET", 400);

    /** 이미 해당 이사 절차에서 결제가 완료되었을 때. */
    static ALREADY_PAYMENT = new APIError("ALREADY_PAYMENT", 400);
}

// stage/mover/payment
export const STAGE_MOVER_PAYMENT_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageMoverPaymentRequest, body);

        const [row] = await DB_CLIENT.query(
            "SELECT proposedPrice, userId FROM MoverRequest a JOIN Stage b ON a.stageId = b.id WHERE a.id = ?",
            [given.requestId]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        // 해당 상품을 결제해야 하는 대상이 아닌 경우.
        if (row.userId != userId) {
            throw StageMoverPaymentError.INVALID_PAYMENT_TARGET;
        }

        const result = await DB_CLIENT.query(
            "SELECT 1 FROM MoverStage WHERE requestId = ? LIMIT 1",
            [given.requestId]
        );

        // 이미 해당 이사 절차에서 결제가 완료된 경우.
        if (!result.isEmpty) {
            throw StageMoverPaymentError.ALREADY_PAYMENT;
        }

        const amount = row.proposedPrice;
        const orderId = API.createUUID();
        const keepData = {
            requestId: given.requestId,
            amount: amount,
        };

        await REDIS_CLIENT.multi()
            .hSet("MoverStageOrder", orderId, JSON.stringify(keepData))
            .hExpire("MoverStageOrder", orderId, 3600) // 1 Hour
            .exec();

        API.success(response, {orderId, amount});
    })
});