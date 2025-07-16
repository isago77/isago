import z from "zod";
import { API, APIError, HTTPHandler } from "core";
import { APISchema } from "../components/api_schema";
import { Auth } from "../components/auth";
import { DB_CLIENT } from "../..";
import { SQLModifier } from "../../sql/sql_modifer";
import { User, UserRole } from "../components/user";

const StageMoverPatchRequest = z.object({
    uuid: APISchema.uuid,
    visitDate: APISchema.date.optional(),
    visitTime: APISchema.time.optional(),
    location: z.string().optional(),
    status: z.enum(["waiting", "visiting", "working"]).optional()
});

const StageMoverGetRequest = z.object({
    // 사용자의 이사 절차에 대한 UUID
    stageId: APISchema.uuid,
});

export class StageMoverError {
    /** 사용자가 요청한 이사를 담당하고 있는 이사 업체가 아닌 경우. */
    static MOVER_NOT_ASSIGNED_TO_STAGE = new APIError("MOVER_NOT_ASSIGNED_TO_STAGE", 403);
}

// stage/mover
export const STAGE_MOVER_HANDLER = new HTTPHandler({
    patch: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageMoverPatchRequest, body);

        { // 유효성 검사 및 제약 조건 확인.
            const [row] = await DB_CLIENT.query(
                `
                    SELECT b.moverId FROM MoverStage a JOIN MoverRequest b ON b.id = a.requestId
                    WHERE a.id = ? LIMIT 1
                `,
                [given.uuid]
            );

            // 유효하지 않은 UUID인 경우.
            if (!row) {
                throw APIError.INVALID_UUID;
            }

            // 해당 이사 절차에서 할당된 견적 담당자가 아닌 경우.
            if (row.moverId != userId) {
                throw StageMoverError.MOVER_NOT_ASSIGNED_TO_STAGE;
            }
        }

        const modifier = new SQLModifier();
        modifier.addIfDefined(given, "visitDate");
        modifier.addIfDefined(given, "visitTime");
        modifier.addIfDefined(given, "location");
        modifier.addIfDefined(given, "status");

        await modifier.safety(async () => {
            const result = await DB_CLIENT.query(
                `UPDATE MoverStage SET ${modifier.setter} WHERE id = ?`,
                [...modifier.values, given.uuid]
            );

            // 해당 이사 절차에서 할당된 견적 담당자가 아닌 경우.
            if (result.affectedRows == 0) {
                throw StageMoverError.MOVER_NOT_ASSIGNED_TO_STAGE
            }
        });

        API.success(response, undefined);
    }),
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(StageMoverGetRequest, API.urlOf(request));

        const fields = [
            "a.id",
            "a.stageId",
            "a.requestId",
            "a.visitDate",
            "a.visitTime",
            "a.location",
            "a.status",
            "a.canceller",
            "a.createdAt",
            "b.moverId",
            "b.proposedPrice",
            "c.userId",
        ];

        const [row] = await DB_CLIENT.query(
            `
                SELECT ${fields.join(", ")} FROM MoverStage a
                JOIN MoverRequest b ON b.id = a.requestId
                JOIN Stage c ON c.id = b.stageId
                WHERE a.stageId = ?
            `,
            [given.stageId]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        // 해당 이사 절차의 사용자이거나 이사 업체가 아닌 경우,
        // 이사 업체 또는 관리자가 아닌 경우 접근할 수 없음.
        if (row.moverId != userId && row.userId != userId) {
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