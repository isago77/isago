import { API, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { DB_CLIENT } from "..";

// notification/stats
export const NOTIFICATION_STATS_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (_1, response, _2, userId) => {
        const [result] = await DB_CLIENT.query(
            `
                SELECT 
                    SUM(isRead = 0) AS unreadCount,
                    SUM(isRead = 1) AS readCount,
                    COUNT(*) AS totalCount
                FROM Notification WHERE userId = ?
            `,
            [userId]
        );

        API.success(response, result);
    })
});