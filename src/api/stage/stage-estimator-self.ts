import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { DB_CLIENT } from "../..";
import { SEARCH_MAX_COUNT, SQLSearcher } from "../../sql/sql_searcher";

export const StageEstimatorSelfRequest = z.object({
    page: z.coerce.number().default(0),
    sort: z.enum(["newest", "oldest"]).default("newest"),
    status: z.enum([
        "waiting",
        "visiting",
        "visited",
        "completed"
    ]).optional()
});

// stage/estimator/self
export const STAGE_ESTIMATOR_SELF_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(StageEstimatorSelfRequest, API.urlOf(request));
        const fields = [
            "a.*",
            "b.userId",
            "b.fromAddress",
            "b.toAddress",
            "b.status AS stageStatus",
            "b.preferredDate",
            "b.createdAt",
            "b.endedAt"
        ];

        const searcher = new SQLSearcher();
        searcher.addIfDefined(given, "status", "a.status = ?");

        const offset = given.page * SEARCH_MAX_COUNT;
        const orderBy = given.sort == "newest"
            ? "a.visitDate DESC"
            : "a.visitDate ASC";

        const result = await DB_CLIENT.query(
            `
                SELECT ${fields.join(", ")} FROM EstimatorStage a JOIN Stage b ON a.stageId = b.id
                WHERE estimatorId = ? ${searcher.isEmpty ? searcher.wheres : `AND ${searcher.wheres}`}
                ORDER BY ${orderBy}
                LIMIT ${SEARCH_MAX_COUNT}
                OFFSET ${offset}
            `,
            [userId, ...searcher.values]
        );

        API.success(response, result);
    })
})