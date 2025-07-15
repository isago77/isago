import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { DB_CLIENT } from "../..";
import { SEARCH_MAX_COUNT, SQLSearcher } from "../../sql/sql_searcher";
import { APISchema } from "../components/api_schema";

export const StageMoverSelfRequest = z.object({
    cursor: APISchema.Search.cursor,
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
            "a.cursor",
            "b.moverId",
            "b.proposedPrice"
        ];

        const searcher = new SQLSearcher();
        searcher.add(userId, "b.moverId = ?");
        searcher.addIfDefined(given, "status", "a.status = ?");

        const result = await searcher.search(
            "MoverStage",
            given.sort,
            given.cursor,
            undefined,
            "JOIN MoverRequest b ON b.stageId = a.stageId",
            fields.join(", "),
        );

        API.success(response, result);
    })
})