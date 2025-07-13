import z from "zod";
import { API, APIError, HTTPHandler } from "core";
import { APISchema } from "../components/api_schema";
import { Auth } from "../components/auth";
import { DB_CLIENT } from "../..";
import { StageMoverStatus } from "./components/stage_mover_status";
import { StageStatus } from "./components/stage_status";
import { SQLTransaction } from "../../sql/sql_transaction";
import { StageMoverError } from "./stage-mover";

const StageMoverDoneRequest = z.object({
    uuid: APISchema.uuid,
});

class StageMoverDoneError {
    /**
     * 이사 완료 처리를 시도했지만, 현재 이사 절차에 대한 상태가 유효하지 않을 때.
     * (e.g. 이미 이사를 완료되었거나, 아직 이사 중이 아닌 상태 등.)
    */
    static INVALID_STAGE_STATUS = new APIError("INVALID_STAGE_STATUS", 400);
}

// stage/mover/done
export const STAGE_MOVER_DONE_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageMoverDoneRequest, body);

        const [row] = await DB_CLIENT.query(
            `
                SELECT a.stageId, b.moverId, a.status FROM MoverStage a JOIN MoverRequest b
                ON a.stageId = b.stageId WHERE a.id = ?
            `,
            [given.uuid]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        // 해당 이사 절차에서 할당된 이사 업체가 아닌 경우.
        if (row.moverId != userId) {
            throw StageMoverError.MOVER_NOT_ASSIGNED_TO_STAGE;
        }

        // 현재 이사 절차가 올바르지 않은 상태임에도 불구하고 이사 완료 처리를 하려고 했을 경우.
        if (row.status != StageMoverStatus.working) {
            throw StageMoverDoneError.INVALID_STAGE_STATUS;
        }

        const stageId = row.stageId;

        await SQLTransaction.perform(async (db) => {
            await db.query(
                "UPDATE Stage SET status = ? WHERE id = ?",
                [StageStatus.completed, stageId]
            );

            await db.query(
                "UPDATE MoverStage SET status = ? WHERE id = ?",
                [StageMoverStatus.completed, given.uuid]
            );
        });

        API.success(response, {uuid: stageId});
    })
});