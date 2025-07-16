import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { DB_CLIENT } from "..";
import { APISchema } from "./components/api_schema";

const NotificationReadRequest = z.object({
    uuid: APISchema.uuid.optional(),
});

// notification/read
export const NOTIFICATION_READ_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(NotificationReadRequest, body);

        const [where, params] = given.uuid
            ? ["userId = ? AND isRead = false AND id = ?", [userId, given.uuid]]
            : ["userId = ? AND isRead = false", [userId]];

        const result = await DB_CLIENT.query(
            `UPDATE Notification SET isRead = true WHERE ${where}`,
            params,
        );

        // 성공적으로 읽음 표시된 메세지의 총 횟수.
        const markedCount = result.affectedRows;

        API.success(response, {markedCount});
    })
});