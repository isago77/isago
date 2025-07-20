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
import { Notification } from "../components/notification";

const StageEstimatorPostRequest = z.object({
    uuid: APISchema.uuid
});

const StageEstimatorGetRequest = z.object({
    // 사용자의 이사 절차에 대한 UUID
    stageId: APISchema.uuid,
})

const StageEstimatorPatchRequest = z.object({
    uuid: APISchema.uuid,
    visitDate: APISchema.date.optional(),
    location: z.string().optional(),
    details: z.array(z.any()).optional(),
    status: z.enum(["waiting", "visiting", "visited"]).optional()
});

export class StageEstimatorError {
    /** 견적 방문자가 이미 할당되어 이사 절차가 진행 중인 경우. */
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

        // 요청한 이사 절차에 대한 유효성 검사.
        const [stage] = await DB_CLIENT.query(
            "SELECT status, userId FROM Stage WHERE id = ? LIMIT 1",
            [given.uuid]
        );

        // 유효하지 않은 UUID인 경우.
        if (!stage) throw APIError.INVALID_UUID;

        // 견적 방문자가 이미 할당되어 이사 절차가 진행 중인 경우.
        if (stage.status != StageStatus.waitingEstimator) {
            throw StageEstimatorError.ONLY_WAITING_ESTIMATOR_STATUS;
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

        // 빠른 응답을 위해 알림 전송은 별개로.
        User.displayNameOf(userId).then(async displayName => {

            // 새로운 이사 절차에 자동 할당된 견적 방문자에게 해당 사실을 알림.
            await Notification.sendTo(stage.userId, {
                type: "estimatorAssigned",
                data: JSON.stringify({stageId: uuid}),
                body: {
                    title: "견적 방문자가 할당되었습니다!",
                    body: `이제 ${displayName}님이 당신의 이사를 도와드릴거에요.`,
                }
            });
        }).catch(() => null);

        API.success(response, {uuid});
    }),
    patch: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageEstimatorPatchRequest, body);

        // 유효성 검사 및 제약 조건 확인.
        const [estimatorStage] = await DB_CLIENT.query(
            "SELECT estimatorId, stageId FROM EstimatorStage WHERE id = ? LIMIT 1",
            [given.uuid]
        );

        // 유효하지 않은 UUID인 경우.
        if (!estimatorStage) {
            throw APIError.INVALID_UUID;
        }

        // 해당 이사 절차에서 할당된 견적 담당자가 아닌 경우.
        if (estimatorStage.estimatorId != userId) {
            throw StageEstimatorError.ESTIMATOR_NOT_ASSIGNED_TO_STAGE;
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

        // 견적 절차에 대한 이사 절차의 사용자에게 해당 사실을 알림.
        if (given.status == "visiting"
         || given.status == "visited") {
            (async () => {
                const [stage] = await DB_CLIENT.query(
                    "SELECT userId FROM Stage WHERE id = ? LIMIT 1",
                    [estimatorStage.stageId]
                );

                const data = JSON.stringify({
                    stageId: estimatorStage.stageId,
                    estimatorStageId: given.uuid,
                });

                if (given.status == "visiting") {
                    await Notification.sendTo(stage.userId, {
                        type: "estimatorVisiting",
                        data: data,
                        body: {
                            title: "견적 방문자가 방문 중이에요",
                            body: "잠시 후 도착할 예정이에요. 문의사항이 있으면 미리 준비해 주세요.",
                        }
                    });
                } else {
                    await Notification.sendTo(stage.userId, {
                        type: "estimatorVisited",
                        data: data,
                        body: {
                            title: "견적 방문자가 견적을 시작했어요",
                            body: "견적이 완료되면 결과를 앱에서 바로 확인하실 수도 있어요."
                        }
                    });
                }
            })().catch(() => null);
        }

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
            [given.stageId]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        // 해당 이사 절차의 사용자이거나 견적 방문자가 아닌 경우,
        // 이사 업체 또는 관리자가 아닌 경우 접근할 수 없음.
        if (row.estimatorId != userId && row.userId != userId) {
            const role = await User.roleOf(userId);

            if (role != UserRole.mover
             && role != UserRole.admin) {
                response.writeHead(403);
                response.end();
                return;
            }
        }

        API.success(response, row);
    })
});