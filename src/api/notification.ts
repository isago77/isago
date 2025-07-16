import z from "zod";
import { API, APIError, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { SQLSearcher } from "../sql/sql_searcher";
import { DB_CLIENT } from "..";

export const NotificationGetRequest = z.object({
    sort: APISchema.Search.sort,
    cursor: APISchema.Search.cursor,
    isRead: z.coerce.boolean().optional(),
});

export const NotificationDelRequest = z.object({
    uuid: APISchema.uuid.optional(),
});

// notification
export const NOTIFICATION_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(NotificationGetRequest, API.urlOf(request));

        const searcher = new SQLSearcher();
        searcher.add(userId, "a.userId = ?");
        searcher.addIfDefined(given, "isRead", "a.isRead = ?");

        const result = await searcher.search(
            "Notification",
            given.sort,
            given.cursor,
            undefined,
            undefined,
            "a.id, a.type, a.data, a.body, a.isRead, a.createdAt"
        );

        API.success(response, result);
    }),
    delete: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(NotificationDelRequest, API.urlOf(request));

        const [query, params] = given.uuid
            ? ["DELETE IGNORE FROM Notification WHERE id = ? AND userId = ?", [given.uuid, userId]]
            : ["DELETE IGNORE FROM Notification WHERE userId = ?", [userId]];

        const result = await DB_CLIENT.query(
            query,
            params,
        );

        // 유효하지 않은 UUID인 경우.
        if (given.uuid && result.affectedRows == 0) {
            throw APIError.INVALID_UUID;
        }

        // 성공적으로 삭제 처리된 알림의 총 횟수.
        const removedCount = result.affectedRows;

        API.success(response, {removedCount});
    }),
});