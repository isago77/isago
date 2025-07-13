import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { APISchema } from "../components/api_schema";
import { DB_CLIENT } from "../..";
import { APIError } from "core/src";
import { StageStatus } from "./components/stage_status";
import { StageEstimatorStatus } from "./components/stage_estimator_status";
import { Pool, PoolConnection } from "mariadb/*";
import { SQLTransaction } from "../../sql/sql_transaction";
import { StageMoverStatus } from "./components/stage_mover_status";
import { Payment } from "../components/payment";

const StageCancelRequest = z.object({
    uuid: APISchema.uuid,
    cancelReason: z.string().optional(),
});

class StageCancelError {
    /** 해당 이사 절차가 취소할 수 없는 상태일 때. */
    static STATUS_CANNOT_CANCEL = new APIError("STATUS_CANNOT_CANCEL", 400);
}

// stage/cancel
export const STAGE_CANCEL_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageCancelRequest, body);

        const [row] = await DB_CLIENT.query(
            "SELECT userId, status FROM Stage WHERE id = ? LIMIT 1",
            [given.uuid]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        // 해당 이사 절차를 생성한 사용자가 아닌 경우.
        if (row.userId != userId) {
            response.writeHead(403);
            response.end();
            return;
        }

        // 해당 이사 절차에서 최종적으로 취소를 명시적으로 정의합니다.
        async function ensureCancelled(db: Pool | PoolConnection) {
            await db.query(
                "UPDATE Stage SET status = ?, endedAt = CURRENT_TIMESTAMP WHERE id = ?",
                [StageStatus.cancelled, given.uuid]
            );
        }

        // 1. 견적 방문자 대기 중
        // 2. 견적 완료
        // 3. 이사 업체 제안/수락 대기
        if (row.status == StageStatus.waitingEstimator
         || row.status == StageStatus.estimateCompleted
         || row.status == StageStatus.waitingMover) {
            await ensureCancelled(DB_CLIENT);
        } else if (row.status == StageStatus.estimatorAssigned) {
            const [estimatorStage] = await DB_CLIENT.query(
                "SELECT status FROM EstimatorStage WHERE stageId = ? LIMIT 1",
                [given.uuid]
            );

            // 견적 방문자가 사용자의 거처에 방문하고 있는 상태일 경우.
            if (estimatorStage.status == StageEstimatorStatus.visiting
             || estimatorStage.status == StageEstimatorStatus.visited) {
                throw StageCancelError.STATUS_CANNOT_CANCEL;
            }

            await SQLTransaction.perform(async (db) => {
                await ensureCancelled(db);
                await db.query(
                    "UPDATE EstimatorStage SET status = ? WHERE stageId = ?",
                    [StageEstimatorStatus.cancelled, given.uuid]
                );
            });
        } else if (row.status == StageStatus.requestAccepted) {
            const [moverStage] = await DB_CLIENT.query(
                "SELECT status, paymentKey FROM MoverStage WHERE stageId = ? LIMIT 1",
                [given.uuid]
            );

            // 준비 또는 대기 중인 경우.
            if (moverStage.status != StageMoverStatus.waiting) {
                throw StageCancelError.STATUS_CANNOT_CANCEL;
            }

            // 사용자의 이사 비용 결제에 대한 환불 진행.
            await Payment.cancel({
                paymentKey: moverStage.paymentKey,
                cancelReason: given.cancelReason ?? "구매자가 취소를 원함"
            });

            await SQLTransaction.perform(async (db) => {
                await ensureCancelled(db);
                await db.query(
                    "UPDATE MoverStage SET status = ?, canceller = ? WHERE stageId = ?",
                    [StageMoverStatus.cancelled, userId, given.uuid]
                );
            });
        } else {
            throw StageCancelError.STATUS_CANNOT_CANCEL;
        }

        API.success(response, undefined);
    })
});