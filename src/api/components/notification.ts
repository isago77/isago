import { API } from "core";
import { Firebase } from "./firebase";
import { DB_CLIENT } from "../..";

interface NotificationPayload {
    type: string;
    data: string;
    body: NotificationContent;
}

interface NotificationContent {
    title?: string;     // 알림 제목
    body?: string;      // 알림 본문
    imageUrl?: string;  // 알림 대표 이미지
}

export class Notification {
    /** 지정된 사용자에게 알림을 전송하고, 영구적으로 이를 기록합니다. */
    static async sendTo(
        userId: string,
        payload: NotificationPayload,
    ): Promise<boolean> {
        const uuid = API.createUUID();

        await DB_CLIENT.query(
            "INSERT INTO Notification(id, userId, type, data, body) VALUES(?, ?, ?, ?, ?)",
            [uuid, userId, payload.type, payload.data, payload.body]
        );

        return await Firebase.sendFCM({
            userId: userId,
            details: {
                uuid: uuid,
                type: payload.type,
                data: JSON.stringify(payload.data),
                body: JSON.stringify(payload.body),
            },
            notification: {
                title: payload.body.title,
                body: payload.body.body,
                imageUrl: payload.body.imageUrl,
            }
        });
    }
}