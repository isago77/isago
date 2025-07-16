import z from "zod";
import dayjs from "dayjs";
import { APISchema } from "../api/components/api_schema";
import { WebSocket, WebSocketServer } from "ws";
import { DB_CLIENT, server } from "..";
import { Auth } from "../api/components/auth";
import { API, APIError } from "core";
import { ArrayMultimap } from "@teppeis/multimaps";
import { User } from "../api/components/user";
import { Notification } from "../api/components/notification";

export type ChatConnection = {
    userId: string;
    socket: WebSocket;
}

const ChatRequest = z.object({
    targetId: APISchema.uuid,
});

// 클라이언트 측에서 전송하는 메시지 형태들 중에서 텍스트의 경우.
const ChatMessageText = z.object({
  type: z.literal("text"),
  body: z.string(),
});

// 클라이언트 측에서 전송하는 메시지 형태들 중에서 이미지의 경우.
const ChatMessageImage = z.object({
  type: z.literal("image"),
  body: z.array(APISchema.url),
});

// 클라이언트 측에서 전송하는 메세지 기본 형태.
const ChatMessageRequest = z.discriminatedUnion("type", [
    ChatMessageText,
    ChatMessageImage,
]);

class ChatError {
    /** 사용자가 자기 자신에게 메세지를 보내려 했을 때. */
    static CANNOT_SELF = new APIError("CANNOT_SELF", 400);
}

/** 특정 사용자에 대한 메세지를 현재 수신하고 있는 사용자. */
const connections = new ArrayMultimap<string, ChatConnection>();

/**
 * 특정 사용자가 수신 중인 연결들 중에서 상대방 아이디가
 * 일치하는 연결 관련 인스턴스를 찾아 이를 반환합니다.
 */
export function chatConnectionOf(selfId: string, userId: string) {
    const recipients = connections.get(selfId);
    const target = recipients.find(e => e.userId == userId);
    return target;
}

setImmediate(() => {
    // 같은 포트에 WebSocket 서버 초기화.
    const wss = new WebSocketServer({server, path: "/chat"});

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
            try {
                const senderId = userId;
                const sendedAt = dayjs().format("YYYY-MM-DD HH:mm:ss");
                const target = chatConnectionOf(senderId, targetId);
                const uuid = API.createUUID()
                const message = data.toString();
                let isRead = target ? true : false;

                // 주어진 메세지의 고유 정보.
                const body = {uuid, message, senderId, sendedAt, isRead};
    
                // 주어진 메세지의 응답 정보.
                const response = JSON.stringify({type: "message", body});
    
                // 메세지를 보낸 사용자를 수신하는 사용자가 있을 경우.
                if (target) {
                    target.socket.send(response);
                } {
                    // 알림 형태로 메세지 전송.
                    (async () => {
                        const given = API.tryParseJSON(ChatMessageRequest, message);
                        const displayName = await User.displayNameOf(userId);
    
                        if (given.type == "text") {
                            await Notification.sendTo(targetId, {
                                type: "message",
                                data: JSON.stringify(body),
                                body: {
                                    title: `${displayName}님이 메세지를 보냈습니다.`,
                                    body: given.body,
                                }
                            });
                        } else {
                            await Notification.sendTo(targetId, {
                                type: "message",
                                data: JSON.stringify(body),
                                body: {
                                    title: `${displayName}님이 이미지 ${given.body.length}개 보냈습니다.`,
                                    imageUrl: given.body[0]
                                }
                            });
                        }
                    })().catch(() => {
                        // 역직렬화 중에 또는 전송 중에 예외 발생.
                        ws.close(4000);
                    });
                }
    
                // 보낸 이에게도 주어진 메시지 정보를 전송할 필요가 있음.
                ws.send(response);
    
                // 주어진 메세지를 영구적으로 저장.
                await DB_CLIENT.query(
                    "INSERT INTO Chat(id, senderId, targetId, message, createdAt, isRead) VALUES(?, ?, ?, ?, ?, ?)",
                    [uuid, senderId, targetId, message, sendedAt, isRead]
                ).catch(() => null);
    
                activeChatBy(uuid, senderId, targetId);
                activeChatBy(uuid, targetId, senderId);
            } catch (error) {
                ws.close(4000);
            }
        });

        // 연결이 끊어질 시, 매핑되어 있던 인스턴스도 같이 폐기.
        ws.on("close", () => connections.delete(targetId));
    }));
});