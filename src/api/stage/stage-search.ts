import { API, HTTPHandler } from "core";
import z from "zod";
import { Auth } from "../components/auth";
import { User, UserError, UserRole } from "../components/user";
import { SearchSort, SQLSearcher } from "../../sql/sql_searcher";
import { DB_CLIENT } from "../..";
import { APISchema } from "../components/api_schema";

const StageSearchRequest = z.object({
    page: z.coerce.number().default(0),
    sort: APISchema.Search.sort,
    status: z.enum([
        "waitingEstimator",
        "estimatorAssigned",
        "estimateCompleted",
        "waitingMover",
        "requestAccepted",
        "completed",
        "cancelled"
    ]).optional()
});

export const STAGE_SEARCH_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(StageSearchRequest, API.urlOf(request));
        const role = await User.roleOf(userId);

        // 사용자 역할에 따른 권한 부족.
        if (!role) throw UserError.REQUIRES_ROLE;

        const searcher = new SQLSearcher();
        searcher.addIfDefined(given, "status", "status = ?");

        let result: any[] = await searcher.search(
            "Stage",
            given.page,
            given.sort as SearchSort
        );

        // 이사 업체의 경우, 해당 이사 절차에 이미 견적을 제안했는지에 대한 여부를 추가적으로 정의해야 함.
        if (role == UserRole.mover
         || role == UserRole.admin) {
            const stageIds = result.map(stage => stage.id);

            if (stageIds.length > 0) {
                const rows = await DB_CLIENT.query(
                    `SELECT id, stageId FROM MoverRequest WHERE stageId IN (?) AND moverId = ?`,
                    [stageIds, userId]
                );

                // stageId -> requestId 매핑
                const requestMap = new Map<string, string>(
                    rows.map((row: any) => [row.stageId, row.id])
                );

                result = result.map(stage => ({
                    ...stage,
                    requestId: requestMap.get(stage.id) ?? null
                }));
            }
        }

        API.success(response, result);
    })
});