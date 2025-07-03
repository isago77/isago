import { z } from "zod";
import { HTTPHandler } from "../core/http_handler";
import { Auth } from "./components/auth";
import { API } from "./components/api";
import { DB_CLIENT, REDIS_CLIENT } from "..";
import { APILength } from "./components/api_length";
import { APIError } from "./components/api_error";
import { randomBytes } from "crypto";

/** 서버 측에서 정의한 비밀번호 변경 요청 정보에 대한 데이터 형태. */
const ResetPasswordAuth = z.object({
    userId: z.string(),
    numbers: z.string()
});

const ResetPasswordVerifyRequest = z.object({
    uuid: z.string()
        .min(APILength.uuid)
        .max(APILength.uuid),

    numbers: z.string()
        .min(Auth.LENGTH)
        .max(Auth.LENGTH),

    password: z.string()
});

// reset-password/auth
export const RESET_PASSWORD_AUTH_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(ResetPasswordVerifyRequest, body);

        const rawInfo = await REDIS_CLIENT.hGet("ResetPasswordAuth", given.uuid);
        if (!rawInfo) throw APIError.INVALID_UUID;

        const info = API.tryParseJSON(ResetPasswordAuth, rawInfo);

        // 주어진 인증 번호가 기존 할당된 인증 번호와 일치하는지 확인.
        if (info.numbers != given.numbers) {
            throw APIError.INVALID_AUTH_NUMBERS;
        }

        const passSalt = Auth.hashAsBase64("sha256", randomBytes(128));
        const password = Auth.hashAsBase64("sha512", given.password + passSalt);

        await DB_CLIENT.query(
            "UPDATE User SET password = ?, passwordSalt = ? WHERE id = ? LIMIT 1",
            [password, passSalt, info.userId]
        );

        API.success(response, undefined);
    }
});