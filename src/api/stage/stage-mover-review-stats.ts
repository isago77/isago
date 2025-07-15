import z from "zod";
import { API, HTTPHandler } from "core"
import { APISchema } from "../components/api_schema";
import { DB_CLIENT } from "../..";

const GetRequest = z.object({
    moverId: APISchema.uuid,
});

// stage/mover/review/stats
export const STAGE_MOVER_REVIEW_STATS_HANDLER = new HTTPHandler({
    get: async (request, response, _) => {
        const given = API.tryParseURL(GetRequest, API.urlOf(request));

        const fields = [
            "COUNT(*) AS totalCount",
            "AVG(a.rating) AS averageRating",
        ]

        const [row] = await DB_CLIENT.query(
            `
                SELECT ${fields.join(", ")} FROM MoverReview a
                JOIN MoverStage b ON b.stageId = a.stageId
                JOIN MoverRequest c ON c.id = b.requestId
                WHERE moverId = ?
            `,
            [given.moverId]
        );

        // 문자열로 정의된 평균 평점 값을 숫자로 변환.
        row.averageRating = parseFloat(row.averageRating);

        API.success(response, row);
    }
});