import { HTTPHandler } from "core";
import { Auth } from "./components/auth";
import z from "zod";
import { APISchema } from "./components/api_schema";
import { API } from "core/src";
import { SQLSearcher } from "../sql/sql_searcher";
import { User, UserError, UserRole } from "./components/user";

const GetRequest = z.object({
    sort: APISchema.Search.sort,
    cursor: APISchema.Search.cursor,
    userId: APISchema.uuid.optional(),
    status: z.enum([
        "pending",
        "accepted",
        "rejected",
    ]).optional(),
});

// business/review/search
export const BUSINESS_REVIEW_SEARCH_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, body, userId) => {
        const given = API.tryParseURL(GetRequest, API.urlOf(request));
        const role = await User.roleOf(userId);

        // 관리자가 아닌 경우에도 자신을 제외한 제3자에 대한 제출 정보를 조회하려고 하는 경우.
        if (role != UserRole.admin) {
            if (given.userId != null && given.userId != userId) {
                throw UserError.ONLY_ADMIN;
            }
        }

        const searcher = new SQLSearcher();
        searcher.addIfDefined(given, "userId", "a.userId = ?");
        searcher.addIfDefined(given, "status", "a.status = ?");

        const result = await searcher.search(
            "BusinessReview",
            given.sort,
            given.cursor,
        );

        API.success(response, result);
    }),
});