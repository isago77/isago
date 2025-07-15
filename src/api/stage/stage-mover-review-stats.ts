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

        const [[result], distributions] = await Promise.all([
            // 전체 리뷰 수와 평균 평점을 조회합니다.
            DB_CLIENT.query(
                `
                    SELECT ${fields.join(", ")} FROM MoverReview a
                    JOIN MoverStage b ON b.stageId = a.stageId
                    JOIN MoverRequest c ON c.id = b.requestId
                    WHERE moverId = ?
                `,
                [given.moverId]
            ),

            // 평점별 리뷰 개수를 조회합니다. (0~5점)
            DB_CLIENT.query(
                `
                    SELECT a.rating, COUNT(*) AS count
                    FROM MoverReview a
                    JOIN MoverStage b ON b.stageId = a.stageId
                    JOIN MoverRequest c ON c.id = b.requestId
                    WHERE c.moverId = ?
                    GROUP BY a.rating
                `,
                [given.moverId]
            ),
        ]);

        // 문자열로 정의된 평균 평점 값을 숫자로 변환.
        result.averageRating = parseFloat(result.averageRating);

        // 평점 분포 데이터 정의.
        result.distributions = distributions;

        API.success(response, result);
    }
});