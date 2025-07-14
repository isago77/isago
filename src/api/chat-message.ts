import z from "zod";
import { API, APIError, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { DB_CLIENT } from "..";

const ChatMessageRequest = z.object({
    uuid: APISchema.uuid,
});

// chat/message
export const CHAT_MESSAGE_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, body, userId) => {
        const given = API.tryParseURL(ChatMessageRequest, API.urlOf(request));

        const [row] = await DB_CLIENT.query(
            "SELECT * FROM Chat WHERE id = ? LIMIT 1",
            [given.uuid, userId, userId]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        // 해당 메시지의 수신자 또는 보낸 이가 아닌 경우.
        if (row.senderId != userId
         && row.targetId != userId) {
            response.writeHead(403);
            response.end();
            return;
        }

        API.success(response, row);
    })
});