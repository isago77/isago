import z from "zod";
import { APISchema } from "../api/components/api_schema";
import { WebSocket, WebSocketServer } from "ws";
import { DB_CLIENT, server } from "..";
import { Auth } from "../api/components/auth";
import { API } from "core";
import { ArrayMultimap } from "@teppeis/multimaps";
import dayjs from "dayjs";

type ChatConnection = {
    userId: string;
    socket: WebSocket;
}

const ChatSendRequest = z.object({
    targetId: APISchema.uuid,
});

// 같은 포트에 WebSocket 서버 초기화.
const wss = new WebSocketServer({server, path: "/chat"});

// 특정 사용자에 대한 메세지를 현재 수신하고 있는 사용자.
const connections = new ArrayMultimap<string, ChatConnection>();

wss.on("connection", Auth.delegateWS((ws, request, userId) => {
    const given = API.tryParseURL(ChatSendRequest, API.urlOf(request));
    const targetId = given.targetId;

    // 상대방을 수신하고 있다고 정의.
    connections.put(targetId, {userId, socket: ws});

    // 연결된 사용자가 메세지를 보냈을 경우.
    ws.on("message", (data) => {
        const recipients = connections.get(userId);
        const target = recipients.find(e => e.userId == targetId);
        const uuid = API.createUUID()
        const message = data.toString();
        const sendedAt = dayjs().format("YYYY-MM-DD HH:mm:ss");

        // 메세지를 보낸 사용자를 수신하는 사용자가 있을 경우.
        if (target) {
            target.socket.send(JSON.stringify({uuid, message, sendedAt}));
        }

        DB_CLIENT.query(
            "INSERT INTO Chat(id, senderId, targetId, message, createdAt) VALUES(?, ?, ?, ?, ?)",
            [uuid, userId, targetId, message, sendedAt]
        ).catch(() => null);
    });

    // 연결이 끊어질 시, 매핑되어 있던 인스턴스도 같이 폐기.
    ws.on("close", () => connections.delete(targetId));
}));