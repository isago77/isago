import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { DB_CLIENT } from "..";

const FirebaseTokenRequest = z.object({
    fcmToken: z.string().max(512),
    deviceId: z.string().max(64),
});

// firebase/token
export const FIREBASE_TOKEN_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(FirebaseTokenRequest, body);

        const result = await DB_CLIENT.query(
            "UPDATE IGNORE FCMToken SET token = ? WHERE deviceId = ? AND userId = ?",
            [given.fcmToken, given.deviceId, userId]
        );

        // 사용자가 처음으로 특정 디바이스에서 FCM 토큰에 대한 등록을 시도한 경우.
        if (result.affectedRows == 0) {
            await DB_CLIENT.query(
                "INSERT INTO FCMToken(token, deviceId, userId) VALUES(?, ?, ?)",
                [given.fcmToken, given.deviceId, userId]
            );
        }

        API.success(response, undefined);
    })
});