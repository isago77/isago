import { z } from "zod";
import { API, APIError, HTTPHandler } from "core";
import { APISchema } from "./components/api_schema";
import { Auth, AuthProvider } from "./components/auth";
import { Mail } from "./components/mail";
import { DB_CLIENT, REDIS_CLIENT } from "..";

const ResetPasswordRequest = z.object({
    email: APISchema.email
});

class ResetPasswordError {
    static INVALID_EMAIL = new APIError("INVALID_EMAIL", 400);
}

// reset-password
export const RESET_PASSWORD_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(ResetPasswordRequest, body);

        const [row] = await DB_CLIENT.query(
            "SELECT id FROM User WHERE email = ?",
            [given.email]
        );

        // 유효하지 않은 이메일일 경우.
        if (!row) throw ResetPasswordError.INVALID_EMAIL;

        const userId = row.id;
        const authUUID = API.createUUID();
        const authNums = Auth.createNumbers();
        const provider = await Auth.providerOf(userId);

        // OAuth 방식으로 로그인된 사용자의 경우, 비밀번호를 설정할 수 없습니다.
        if (provider != AuthProvider.self) {
            throw APIError.CANNOT_OAUTH;
        }

        await Mail.sendAuthNumbers("이사고 비밀번호 변경을 위한 인증 번호", given.email, authNums);

        REDIS_CLIENT.multi()
            // 비밀번호 변경 요청에 대한 추가적인 인증 작업을 위한 인증 번호를 설정합니다.
            .hSet("ResetPasswordAuth", authUUID, JSON.stringify({userId, ...{numbers: authNums}}))
            // 해당 인증 번호에 대한 만료 시간을 설정합니다. (예시: 10분)
            .hExpire("ResetPasswordAuth", authUUID, Auth.DURATION)
            .exec();

        API.success(response, {uuid: authUUID});
    },
});