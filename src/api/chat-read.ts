import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { DB_CLIENT } from "..";
import { ChatConnection, chatConnectionOf } from "../socket/chat";

const ChatReadRequest = z.object({
    senderId: APISchema.uuid,
});

// chat/read
export const CHAT_READ_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(ChatReadRequest, body);
        const senderId = given.senderId;
        const targetId = userId;

        const result = await DB_CLIENT.query(
            "UPDATE Chat SET isRead = true WHERE senderId = ? AND targetId = ? AND isRead = false",
            [senderId, targetId]
        );

        // 성공적으로 읽음 표시된 메세지의 총 횟수.
        const markedCount = result.affectedRows;

        // 주어진 채팅 연결이 존재할 경우, 해당 소켓에 응답에 관련한 정보를 전달합니다.
        function sendBySocket(connection?: ChatConnection) {
            connection?.socket.send(JSON.stringify({
                type: "reading",
                body: {markedCount}
            }));
        }

        if (markedCount > 0) {
            // 읽음 표시한 사용자가 읽음 처리한 대상자의 메시지를 보낸 이가
            // 현재 메세지 수신 중일 경우, 웹 소켓으로 해당 정보를 전달.
            sendBySocket(chatConnectionOf(userId, senderId));
            sendBySocket(chatConnectionOf(targetId, userId));
        }

        API.success(response, {markedCount});
    })
});