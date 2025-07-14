import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { DB_CLIENT } from "../..";
import { SEARCH_MAX_COUNT, SQLSearcher } from "../../sql/sql_searcher";
import { APISchema } from "../components/api_schema";

export const StageMoverSelfRequest = z.object({
    page: APISchema.Search.page,
    sort: APISchema.Search.sort,
    status: z.enum([
        "waiting",
        "visiting",
        "working",
        "completed"
    ]).optional()
});

// stage/mover/self
export const STAGE_MOVER_SELF_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(StageMoverSelfRequest, API.urlOf(request));
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
            "b.proposedPrice"
        ];

        const searcher = new SQLSearcher();
        searcher.addIfDefined(given, "status", "a.status = ?");

        const offset = given.page * SEARCH_MAX_COUNT;
        const orderBy = given.sort == "newest"
            ? "a.visitDate DESC"
            : "a.visitDate ASC";

        const result = await DB_CLIENT.query(
            `
                SELECT ${fields.join(", ")} FROM MoverStage a
                JOIN MoverRequest b ON b.stageId = a.stageId
                WHERE b.moverId = ? ${searcher.isEmpty ? searcher.wheres : `AND ${searcher.wheres}`}
                ORDER BY ${orderBy}
                LIMIT ${SEARCH_MAX_COUNT}
                OFFSET ${offset}
            `,
            [userId, ...searcher.values]
        );

        API.success(response, result);
    })
})