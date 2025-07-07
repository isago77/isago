import { APIError, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import z from "zod";
import { APISchema } from "../components/api_schema";
import { API } from "core/src";
import { DB_CLIENT } from "../..";
import { SQLTransaction } from "../../sql/sql_transaction";
import { StageStatus } from "./components/stage_status";

const StageRequest = z.object({
    availableId: APISchema.uuid.optional(),
    fromAddress: APISchema.address,
    toAddress: APISchema.address,
});

class StageError {
    /** 이미 만료된 견적 일정일 때. */
    static EXPIRED_ESTIMATOR_AVAILABILITY = new APIError("EXPIRED_ESTIMATOR_AVAILABILITY", 400);
}

export const STAGE_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageRequest, body);
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
    get: Auth.delegate(async (_1, response, _2, userId) => {
        const result = await DB_CLIENT.query(
            "SELECT * FROM Stage WHERE userId = ? ORDER BY createdAt DESC",
            [userId]
        );

        API.success(response, result);
    }),
});