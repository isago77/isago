import z from "zod";
import { API, HTTPHandler } from "core"
import { APISchema } from "../components/api_schema";
import { SQLSearcher } from "../../sql/sql_searcher";
import { Auth } from "../components/auth";

const GetRequest = z.object({
    sort: APISchema.Search.sort,
    cursor: APISchema.Search.cursor,
});

// stage/mover/review/self
export const STAGE_MOVER_REVIEW_SELF_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(GetRequest, API.urlOf(request));

        const searcher = new SQLSearcher();
        searcher.add(userId, "a.writerId = ?");

        const result = await searcher.search(
            "MoverReview",
            given.sort,
            given.cursor,
            undefined,
            undefined,
        );

        API.success(response, result);
    })
});