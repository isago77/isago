import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { SQLSearcher } from "../../sql/sql_searcher";
import { APISchema } from "../components/api_schema";

export const StageEstimatorSelfRequest = z.object({
    cursor: APISchema.Search.cursor,
    sort: APISchema.Search.sort,
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
            "b.endedAt"
        ];

        const searcher = new SQLSearcher();
        searcher.add(userId, "estimatorId = ?");
        searcher.addIfDefined(given, "status", "a.status = ?");

        const result = await searcher.search(
            "EstimatorStage",
            given.sort,
            given.cursor,
            undefined,
            "JOIN Stage b ON a.stageId = b.id",
            fields.join(", ")
        );

        API.success(response, result);
    })
})