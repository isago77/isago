import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import z from "zod";
import { APISchema } from "../components/api_schema";
import { DB_CLIENT } from "../..";
import { APIError } from "core/src";
import { StageEstimatorError } from "./stage-estimator";
import { SQLTransaction } from "../../sql/sql_transaction";
import { StageStatus } from "./components/stage_status";
import { StageEstimatorStatus } from "./components/stage_estimator_status";

const StageEstimatorDoneRequest = z.object({
    uuid: APISchema.uuid
});

class StageEstimatorDoneError {
    /** 사용자, 즉 견적 방문자가 아직 견적 내용을 입력하지 않았을 때. */
    static INCOMPLETE_ESTIMATOR = new APIError("INCOMPLETE_ESTIMATOR", 400);

    /**
     * 견적 완료 처리를 시도했지만, 현재 이사 절차에 대한 상태가 유효하지 않을 때.
     * (e.g. 이미 견적이 완료되었거나, 아직 방문 중이 아닌 상태 등.)
    */
    static INVALID_STAGE_STATUS = new APIError("INVALID_STAGE_STATUS", 400);
}

export const STAGE_ESTIMATOR_DONE_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageEstimatorDoneRequest, body);

        const [row] = await DB_CLIENT.query(
            "SELECT stageId, estimatorId, details, status FROM EstimatorStage WHERE id = ?",
            [given.uuid]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        // 해당 이사 절차에서 할당된 견적 담당자가 아닌 경우.
        if (row.estimatorId != userId) {
            throw StageEstimatorError.ESTIMATOR_NOT_ASSIGNED_TO_STAGE;
        }

        // 아직 아무 견적 내용이 정의되지 않았음에도 불구하고 견적 완료 처리를 하려고 했을 경우.
        if (row.details == null) {
            throw StageEstimatorDoneError.INCOMPLETE_ESTIMATOR;
        }

        // 현재 이사 절차가 올바르지 않은 상태임에도 불구하고 견적 완료 처리를 하려고 했을 경우.
        if (row.status != StageEstimatorStatus.visited) {
            throw StageEstimatorDoneError.INVALID_STAGE_STATUS;
        }

        const stageId = row.stageId;

        await SQLTransaction.perform(async (db) => {
            await db.query(
                "UPDATE Stage SET status = ? WHERE id = ?",
                [StageStatus.waitingMover, stageId]
            );

            await db.query(
                "UPDATE EstimatorStage SET status = ? WHERE id = ?",
                [StageEstimatorStatus.completed, given.uuid]
            );
        });

        API.success(response, {uuid: stageId});
    })
});