import z from "zod";
import { API, APIError, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { DB_CLIENT } from "..";

/** 클라이언트 측에서 한 번에 조회할 수 있는 메세지들의 개수. */
const CHAT_SEARCH_MAX_COUNT = 30;

const ChatRequest = z.object({
    targetId: APISchema.uuid,
    offsetId: APISchema.uuid.optional(),
});

export const CHAT_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(ChatRequest, API.urlOf(request));
        let startAt;

        if (given.offsetId) {
            const [row] = await DB_CLIENT.query(
                "SELECT createdAt FROM Chat WHERE id = ?",
                [given.offsetId]
            );

            // 유효하지 않은 UUID인 경우.
            if (!row) throw APIError.INVALID_UUID;

            startAt = row.createdAt;
        }

        const result = await DB_CLIENT.query(
            `
                SELECT * FROM Chat 
                WHERE ((senderId = ? AND targetId = ?)
                    OR (senderId = ? AND targetId = ?))
                ${startAt != null ? "AND createdAt < ?" : ""}
                ORDER BY createdAt DESC
                LIMIT ${CHAT_SEARCH_MAX_COUNT}
            `,
            [userId, given.targetId, given.targetId, userId, startAt].filter(Boolean)
        );

        API.success(response, result);
    })
});