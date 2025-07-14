import z from "zod";
import { APISchema } from "../api/components/api_schema";
import { WebSocket, WebSocketServer } from "ws";
import { DB_CLIENT, server } from "..";
import { Auth } from "../api/components/auth";
import { API, APIError } from "core";
import { ArrayMultimap } from "@teppeis/multimaps";
import dayjs from "dayjs";

type ChatConnection = {
    userId: string;
    socket: WebSocket;
}

const ChatRequest = z.object({
    targetId: APISchema.uuid,
});

class ChatError {
    /** 사용자가 자기 자신에게 메세지를 보내려 했을 때. */
    static CANNOT_SELF = new APIError("CANNOT_SELF", 400);
}

// 같은 포트에 WebSocket 서버 초기화.
const wss = new WebSocketServer({server, path: "/chat"});

// 특정 사용자에 대한 메세지를 현재 수신하고 있는 사용자.
const connections = new ArrayMultimap<string, ChatConnection>();

wss.on("connection", Auth.delegateWS((ws, request, userId) => {
    const given = API.tryParseURL(ChatRequest, API.urlOf(request));
    const targetId = given.targetId;

    // 사용자가 자기 자신에게 메세지를 보내려 했을 경우.
    if (userId == targetId) {
        throw ChatError.CANNOT_SELF;
    }

    // 상대방을 수신하고 있다고 정의.
    connections.put(targetId, {userId, socket: ws});

    // 사용자와 상대방 간의 최신 채팅 정보를 저장하거나 갱신합니다.
    async function activeChatBy(
        chatId: string,
        userId: string,
        otherId: string
    ) {
        const [chat] = await DB_CLIENT.query(
            "SELECT * FROM ActiveChat WHERE userId = ? AND otherId = ? LIMIT 1",
            [userId, otherId]
        );

        if (chat) {
            await DB_CLIENT.query(
                "UPDATE ActiveChat SET latestChatId = ? WHERE userId = ? AND otherId = ?",
                [chatId, userId, otherId]
            );
        } else {
            await DB_CLIENT.query(
                "INSERT INTO ActiveChat(userId, otherId, latestChatId) VALUES(?, ?, ?)",
                [userId, otherId, chatId]
            );
        }
    }

    // 연결된 사용자가 메세지를 보냈을 경우.
    ws.on("message", async (data) => {
        const recipients = connections.get(userId);
        const target = recipients.find(e => e.userId == targetId);
        const uuid = API.createUUID()
        const message = data.toString();
        const sendedAt = dayjs().format("YYYY-MM-DD HH:mm:ss");
        let isRead = target ? true : false;

        const response = JSON.stringify({uuid, message, sendedAt, isRead});

        // 메세지를 보낸 사용자를 수신하는 사용자가 있을 경우.
        if (target) {
            target.socket.send(response);
        }

        // 보낸 이에게도 해당 메시지 정보를 전송할 필요가 있음.
        ws.send(response);

        // 해당 메세지를 영구적으로 저장.
        await DB_CLIENT.query(
            "INSERT INTO Chat(id, senderId, targetId, message, createdAt, isRead) VALUES(?, ?, ?, ?, ?, ?)",
            [uuid, userId, targetId, message, sendedAt, isRead]
        ).catch(() => null);

        activeChatBy(uuid, userId, targetId);
        activeChatBy(uuid, targetId, userId);
    });

    // 연결이 끊어질 시, 매핑되어 있던 인스턴스도 같이 폐기.
    ws.on("close", () => connections.delete(targetId));
}));