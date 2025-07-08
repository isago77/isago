import { APIError, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import z from "zod";
import { APISchema } from "../components/api_schema";
import { API } from "core/src";
import { DB_CLIENT } from "../..";
import { SQLTransaction } from "../../sql/sql_transaction";
import { StageStatus } from "./components/stage_status";

const StagePostRequest = z.object({
    availableId: APISchema.uuid.optional(),
    fromAddress: APISchema.address,
    toAddress: APISchema.address,
}).refine(data => {
    // 출발 위치와 목표 위치는 서로 동일하지 않아야 합니다.
    return data.fromAddress.zipCode != data.toAddress.zipCode;
});

const StageGetRequest = z.object({
    uuid: APISchema.uuid,
});

class StageError {
    /** 이미 만료된 견적 일정일 때. */
    static EXPIRED_ESTIMATOR_AVAILABILITY = new APIError("EXPIRED_ESTIMATOR_AVAILABILITY", 400);
}

export const STAGE_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StagePostRequest, body);
        const uuid = API.createUUID();
        const from = JSON.stringify(given.fromAddress);
        const to = JSON.stringify(given.toAddress);
        const hasEstimator = given.availableId != null;

        await SQLTransaction.perform(async (db) => {
            const status = hasEstimator
                ? StageStatus.estimatorAssigned
                : StageStatus.waitingEstimator;

            await db.query(
                "INSERT INTO Stage(id, userId, fromAddress, toAddress, status) VALUES(?, ?, ?, ?, ?)",
                [uuid, userId, from, to, status]
            );

            if (hasEstimator) {
                const [row] = await db.query(
                    "SELECT estimatorId FROM EstimatorAvailability WHERE id = ?",
                    given.availableId
                );

                // 유효하지 않은 견적 일정에 대한 UUID인 경우.
                if (!row) throw APIError.INVALID_UUID;

                const result = await db.query(
                    "UPDATE EstimatorAvailability SET count = count - 1 WHERE id = ? AND count > 0",
                    [given.availableId]
                );

                // 이미 만료된 견적 일정일 경우.
                if (result.affectedRows == 0) {
                    throw StageError.EXPIRED_ESTIMATOR_AVAILABILITY;
                }

                await db.query(
                    "INSERT INTO EstimatorStage(id, stageId, estimatorId) VALUES(?, ?, ?)",
                    [API.createUUID(), uuid, row.estimatorId]
                );
            }
        });

        API.success(response, {uuid});
    }),
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(StageGetRequest, API.urlOf(request));

        const [row] = await DB_CLIENT.query(
            "SELECT * FROM Stage WHERE id = ? ORDER BY createdAt DESC",
            [given.uuid]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        API.success(response, row);
    }),
});