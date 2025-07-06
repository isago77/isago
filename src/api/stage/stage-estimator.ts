import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import z from "zod";
import { APISchema } from "../components/api_schema";
import { User, UserError, UserRole } from "../components/user";
import { DB_CLIENT } from "../..";
import { APIError } from "core/src";
import { StageStatus } from "./components/stage_status";
import { SQLModifier } from "../../sql/sql_modifer";
import { SQLTransaction } from "../../sql/sql_transaction";

const StageEstimatorPostRequest = z.object({
    uuid: APISchema.uuid
});

const StageEstimatorGetRequest = z.object({
    // 사용자의 이사 절차에 대한 UUID
    uuid: APISchema.uuid
})

const StageEstimatorPatchRequest = z.object({
    uuid: APISchema.uuid,
    visitDate: APISchema.dateTime.optional(),
    location: z.string().optional(),
    details: z.array(z.any()).optional(),
    status: z.enum(["waiting", "visiting", "visited"]).optional()
});

export class StageEstimatorError {
    /** 사용자가 견적 방문자가 아니라서 권한이 부족한 경우. */
    static ONLY_WAITING_ESTIMATOR_STATUS = new APIError("ONLY_WAITING_ESTIMATOR_STATUS", 403);

    /** 사용자가 요청한 견적을 담당하고 있는 견적 방문자가 아닌 경우. */
    static ESTIMATOR_NOT_ASSIGNED_TO_STAGE = new APIError("ESTIMATOR_NOT_ASSIGNED_TO_STAGE", 403);
}

// stage/estimator
export const STAGE_ESTIMATOR_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageEstimatorPostRequest, body);
        const role = await User.roleOf(userId);

        // 요청 대상이 애초부터 관리자 또는 견적 방문자가 아닌 경우.
        if (role != UserRole.estimator
         && role != UserRole.admin) {
            throw UserError.ONLY_ESTIMATOR;
        }

        const db = await DB_CLIENT.getConnection();

        { // 요청한 이사 절차에 대한 유효성 검사.
            const [row] = await db.query(
                "SELECT status FROM Stage WHERE id = ? LIMIT 1",
                [given.uuid]
            );

            // 유효하지 않은 UUID인 경우.
            if (!row) throw APIError.INVALID_UUID;

            // 견적 방문자가 이미 할당되어 이사 절차가 진행 중인 경우.
            if (row.status != StageStatus.waitingEstimator) {
                throw StageEstimatorError.ONLY_WAITING_ESTIMATOR_STATUS;
            }
        }

        const uuid = API.createUUID();

        await SQLTransaction.perform(async (db) => {
            await db.query(
                "UPDATE Stage SET status = ? WHERE id = ?",
                [StageStatus.estimatorAssigned, given.uuid]
            );
            await db.query(
                "INSERT INTO EstimatorStage(id, stageId, estimatorId) VALUES(?, ?, ?)",
                [uuid, given.uuid, userId]
            );
        });

        API.success(response, {uuid});
    }),
    patch: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageEstimatorPatchRequest, body);

        { // 유효성 검사 및 제약 조건 확인.
            const [row] = await DB_CLIENT.query(
                "SELECT estimatorId FROM EstimatorStage WHERE id = ? LIMIT 1",
                [given.uuid]
            );

            // 유효하지 않은 UUID인 경우.
            if (!row) {
                throw APIError.INVALID_UUID;
            }

            // 해당 이사 절차에서 할당된 견적 담당자가 아닌 경우.
            if (row.estimatorId != userId) {
                throw StageEstimatorError.ESTIMATOR_NOT_ASSIGNED_TO_STAGE;
            }
        }

        const modifier = new SQLModifier();
        modifier.addIfDefined(given, "visitDate");
        modifier.addIfDefined(given, "location");
        modifier.addIfDefined(given, "details");
        modifier.addIfDefined(given, "status");

        await modifier.safety(async () => {
            const result = await DB_CLIENT.query(
                `UPDATE EstimatorStage SET ${modifier.setter} WHERE id = ?`,
                [...modifier.values, given.uuid]
            );

            // 해당 이사 절차에서 할당된 견적 담당자가 아닌 경우.
            if (result.affectedRows == 0) {
                throw StageEstimatorError.ESTIMATOR_NOT_ASSIGNED_TO_STAGE
            }
        });

        API.success(response, undefined);
    }),
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(StageEstimatorGetRequest, API.urlOf(request));

        const fields = [
            "a.id",
            "a.stageId",
            "a.estimatorId",
            "a.visitDate",
            "a.location",
            "a.details",
            "a.status",
            "b.userId"
        ]

        const [row] = await DB_CLIENT.query(
            `SELECT ${fields.join(", ")} FROM EstimatorStage a JOIN Stage b ON b.id = a.stageId WHERE a.stageId = ?`,
            [given.uuid]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        // 해당 이사 절차의 사용자이거나 견적 방문자가 아닌 경우.
        if (row.estimatorId != userId && row.userId != userId) {
            response.writeHead(403);
            response.end();
            return;
        }

        API.success(response, row);
    })
});