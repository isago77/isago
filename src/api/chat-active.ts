import z from "zod";
import { API, APIError, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { DB_CLIENT } from "..";
import { APISchema } from "./components/api_schema";
import { SQLSearcher } from "../sql/sql_searcher";

const ChatActiveGetRequest = z.object({
    cursor: APISchema.Search.cursor,
    sort: APISchema.Search.sort,
});

const ChatActiveDelRequest = z.object({
    targetId: APISchema.uuid,
});

// chat/active
export const CHAT_ACTIVE_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(ChatActiveGetRequest, API.urlOf(request));

        const searcher = new SQLSearcher();
        searcher.add(userId, "userId = ?");

        const result = await searcher.search(
            "ActiveChat",
            given.sort,
            given.cursor,
            "b.cursor",
            "JOIN Chat b ON b.id = a.latestChatId",
            "a.otherId, a.latestChatId, b.cursor"
        );

        API.success(response, result);
    }),
    delete: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(ChatActiveDelRequest, API.urlOf(request));

        const result = await DB_CLIENT.query(
            "DELETE FROM ActiveChat WHERE userId = ? AND otherId = ?",
            [userId, given.targetId]
        );

        // 유효하지 않은 UUID인 경우.
        if (result.affectedRows == 0) {
            throw APIError.INVALID_UUID;
        }

        API.success(response, undefined);
    }),
});