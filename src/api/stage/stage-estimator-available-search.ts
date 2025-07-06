import z from "zod";
import { APISchema } from "../components/api_schema";
import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { DB_CLIENT } from "../..";
import { SQLSearcher } from "../../sql/sql_searcher";

const PostRequest = z.object({
    userId: APISchema.uuid.optional(),
    areas: z.array(z.string()),
    dates: z.array(APISchema.date)
});

export const STAGE_ESTIMATOR_AVAILABLE_SEARCH_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(PostRequest, body);

        const searcher = new SQLSearcher();
        searcher.addIfDefined(given, "userId", "userId = ?");
        searcher.add(given.areas, "JSON_OVERLAPS(b.serviceAreas, ?)");

        const result = await DB_CLIENT.query(
            `
                SELECT a.* FROM EstimatorAvailability a
                JOIN UserDetails b ON b.userId = a.estimatorId
                WHERE ${searcher.wheres}
                AND a.date IN (${given.dates.map(() => "?").join(", ")})
            `,
            [searcher.values, ...given.dates]
        );

        API.success(response, result);
    })
});