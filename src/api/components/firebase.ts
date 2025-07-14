import admin, { ServiceAccount } from "firebase-admin";
import serviceAccount from "../../../firebase-service-account.json";
import { DB_CLIENT } from "../..";

export interface Notification {
    title?: string;
    body?: string;
    imageUrl?: string;
}

// Firebase 비공개 키를 이용해 사용자 인증 및 초기화.
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as ServiceAccount)
});

export class Firebase {
    // 주어진 사용자의 아이디에 해당하는 등록된 모든 FCM 토큰들을 반환합니다.
    static async fcmTokensOf(userId: string): Promise<string[] | undefined> {
        const rows: any[] = await DB_CLIENT.query(
            "SELECT token FROM FCMToken WHERE userId = ?",
            [userId]
        );

        return rows.map(row => row.token);
    }

    static async sendFCM(given: {
        userId: string;
        notification: Notification;
        details?: {[key: string]: string};
    }): Promise<boolean> {
        try {
            const tokens = await this.fcmTokensOf(given.userId);

            // 사용자에 대한 유효한 FCM 토큰을 조회할 수 없을 경우.
            if (!tokens) return false;

            const result = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: given.notification,
                data: given.details ?? {},
            });

            return result.successCount > 0;
        } catch (error) {
            return false;
        }
    }
}