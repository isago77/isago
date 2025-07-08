import { API, HTTPHandler } from "core";
import z from "zod";
import { Auth } from "../components/auth";
import { User, UserError } from "../components/user";
import { SearchSort, SQLSearcher } from "../../sql/sql_searcher";

const StageSearchRequest = z.object({
    page: z.coerce.number().default(0),
    sort: z.enum(["newest", "oldest"]).default("newest"),
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

        const result = await searcher.search(
            "Stage",
            given.page,
            given.sort as SearchSort
        );

        API.success(response, result);
    })
});