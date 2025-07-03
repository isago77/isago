import { BinaryLike, createHash, randomBytes } from "crypto";
import { DB_CLIENT, REDIS_CLIENT } from "../..";
import * as http from "http";
import { HTTPHandlerListener } from "core";

export type HTTPAuthHandlerListener = (
    request: http.IncomingMessage,
    response: http.ServerResponse,
    requestBody: Buffer,
    userId: string,
) => Promise<void> | void;

/** 사용자를 식별하는 API 유형. */
export enum AuthProvider {
    self = "self",
    naver = "naver",
    kakao = "kakao",
    apple = "apple"
}

export class Auth {
    static LENGTH = 6;
    static DURATION = 600; // 10 minutes
    static ACCESS_TOKEN_EXPIER_DURATION = 604800; // 1 weak
    static REFRESH_TOKEN_EXPIER_DURATION = 15552000; // 6 month

    static createNumbers(length: number = this.LENGTH) {
        return Array.from({length}).map(_ => Math.floor(Math.random() * 10)).join("");
    }

    /**
     * 서버 측에서 보편적으로 사용되는 UUID v4는 토큰의 특성상 무차별 대입 공격에
     * 취약할 수 있으므로 32바이트(256비트) 형식의 고유 식별자 형태로 생성합니다.
     */
    static createToken() {
        return randomBytes(32).toString("hex");
    }

    /** 주어진 해시 알고리즘으로 입력값을 해싱하고 이를 Base64 형태로 반환합니다. */
    static hashAsBase64(type: "sha256" | "sha512", target: BinaryLike) {
        return createHash(type).update(target).digest("base64");
    }

    static async issueToken(userId: string) {
        const accessToken = Auth.createToken();
        const refreshToken = Auth.createToken();

        await REDIS_CLIENT.multi()
            .hSet("AccessToken", accessToken, userId)
            .hSet("RefreshToken", refreshToken, userId)
            // .sAdd(`AccessToken:${userId}`, accessToken)
            // .sAdd(`RefreshToken:${userId}`, refreshToken)
            .hExpire("AccessToken", accessToken, Auth.ACCESS_TOKEN_EXPIER_DURATION)
            .hExpire("RefreshToken", refreshToken, Auth.REFRESH_TOKEN_EXPIER_DURATION)
            .exec();

        return {accessToken, refreshToken};
    }

    /** 주어진 엑세스 토큰에 해당하는 사용자 아이디를 반환합니다. */
    static async userIdOf(accessToken: string) {
        return await REDIS_CLIENT.hGet("AccessToken", accessToken);
    }

    /** 주어진 사용자 아이디를 기반으로 인증 유형을 반환합니다. */
    static async providerOf(userId: string): Promise<AuthProvider> {
        const [row] = await DB_CLIENT.query(
            "SELECT provider FROM UserOAuth WHERE userId = ? LIMIT 1",
            [userId]
        );

        return row ? row.provider : AuthProvider.self;
    }

    /** 주어진 전화번호 토큰에 해당하는 전화번호를 반환합니다. */
    static async phoneNumberOf(token: string) {
        const result = await REDIS_CLIENT.hGet("PhoneNumberToken", token);

        // 전화번호 토큰은 일회성으로 사용되므로 한번 참조 가능하도록 하되 토큰을 만료시킵니다.
        if (result) {
            await REDIS_CLIENT.hDel("PhoneNumberToken", token);
        }

        return result;
    }

    static delegate(listener: HTTPAuthHandlerListener): HTTPHandlerListener {
        return async (request, response, body) => {
            const accessToken = request.headers.authorization;
            if (!accessToken) {
                response.writeHead(401);
                response.end();
                return;
            }

            const userId = await this.userIdOf(accessToken);
            if (!userId) {
                response.writeHead(401);
                response.end();
                return;
            }

            await listener(request, response, body, userId);
        }
    }
}