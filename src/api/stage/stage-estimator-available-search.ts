import z from "zod";
import { APISchema } from "../components/api_schema";
import { API, HTTPHandler } from "core";
import { DB_CLIENT } from "../..";
import { SQLSearcher } from "../../sql/sql_searcher";
import { APIError } from "core/src";
import { differenceInCalendarDays } from 'date-fns'

const PostRequest = z.object({
    userId: APISchema.uuid.optional(),
    areas: z.array(z.string()).optional(),
    startDate: APISchema.date,
    endDate: APISchema.date,
    minCount: z.number().min(1).default(1),
    maxCount: z.number().min(1).optional()
}).refine((data) => {
    return !data.maxCount || data.maxCount >= data.minCount;
});

// stage/estimator/available/search
export const STAGE_ESTIMATOR_AVAILABLE_SEARCH_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(PostRequest, body);

        const startDate = new Date(given.startDate);
        const endDate = new Date(given.endDate);
        const today = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffInDays = differenceInCalendarDays(endDate, startDate);

        // 필터링에 대한 시작 날짜는 현재 날짜보다 더 커야 합니다.
        // 필터링에 대한 종료 날짜는 시작 날짜보다 더 커야 합니다.
        // 시작 날짜와 종료 날짜의 일자 차이는 31일이거나 그 이하여야 합니다.
        if (startDate < today
         || startDate > endDate
         || diffInDays > 31) {
            throw APIError.INVALID_REQUEST_FORMAT;
        }

        const searcher = new SQLSearcher();
        searcher.addIfDefined(given, "userId", "userId = ?");
        searcher.addIfDefined(given, "maxCount", "a.count <= ?");
        searcher.addIfDefined(given, "areas", "JSON_OVERLAPS(b.serviceAreas, ?)");
        searcher.add(given.minCount, "a.count >= ?");

        const result = await DB_CLIENT.query(
            `
                SELECT a.* FROM EstimatorAvailability a
                JOIN UserDetails b ON b.userId = a.estimatorId
                WHERE ${searcher.wheres}
                AND a.date BETWEEN ? AND ?
            `,
            [...searcher.values, given.startDate, given.endDate]
        );

        API.success(response, result);
    }
});