import z from "zod";
import { API, HTTPHandler } from "core"
import { APISchema } from "../components/api_schema";
import { SQLSearcher } from "../../sql/sql_searcher";

const GetRequest = z.object({
    moverId: APISchema.uuid.optional(),
    sort: APISchema.Search.sort,
    cursor: APISchema.Search.cursor,
});

// stage/mover/review/search
export const STAGE_MOVER_REVIEW_SEARCH_HANDLER = new HTTPHandler({
    get: async (request, response, _) => {
        const given = API.tryParseURL(GetRequest, API.urlOf(request));

        const searcher = new SQLSearcher();
        searcher.addIfDefined(given, "moverId", "c.moverId = ?");

        const result = await searcher.search(
            "MoverReview",
            given.sort,
            given.cursor,
            undefined,
            `
                JOIN MoverStage b ON b.stageId = a.stageId
                JOIN MoverRequest c ON c.id = b.requestId
            `,
            "a.*"
        );

        API.success(response, result);
    }
});