import { z } from "zod";
import { HTTPHandler } from "core";
import { APISchema } from "./components/api_schema";
import { Auth } from "./components/auth";
import { API } from "./components/api";
import { DB_CLIENT, REDIS_CLIENT } from "..";
import { APIError } from "./components/api_error";
import { SignUpRequest, validSignUpRequest } from "./sign_up";
import { randomBytes } from "crypto";

/** 서버 측에서 정의한 회원가입 요청 정보에 대한 데이터 형태. */
const SignUpAuth = SignUpRequest.extend({
    numbers: APISchema.authNumbers
});

export const SignUpVerifyRequest = z.object({
    uuid: APISchema.uuid,
    numbers: APISchema.authNumbers
});

// sign-up/auth
export const SIGN_UP_AUTH_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(SignUpVerifyRequest, body);

        const rawInfo = await REDIS_CLIENT.hGet("SignUpAuth", given.uuid);
        if (!rawInfo) throw APIError.INVALID_UUID;

        const info = API.tryParseJSON(SignUpAuth, rawInfo);
        await validSignUpRequest(info);

        // 주어진 인증 번호가 기존 할당된 인증 번호와 일치하는지 확인.
        if (given.numbers != info.numbers) {
            throw APIError.INVALID_AUTH_NUMBERS;
        }

        const userId = API.createUUID();
        const email = info.email;
        const displayName = info.displayName;
        const passSalt = Auth.hashAsBase64("sha256", randomBytes(128));
        const password = Auth.hashAsBase64("sha512", info.password + passSalt);

        const fields = [
            "id",
            "email",
            "displayName",
            "phoneNumber",
            "password",
            "passwordSalt",
            "marketingAccepted"
        ];

        const phoneNumber = await Auth.phoneNumberOf(info.phoneNumberToken);

        // 유효하지 않은 전화번호 토큰일 경우.
        if (!phoneNumber) {
            throw APIError.INVALID_PHONE_NUMBER_TOKEN;
        }

        await DB_CLIENT.query(
            `INSERT INTO User(${fields.join(", ")}) VALUES(${fields.map(_ => "?").join(", ")})`,
            [userId, email, displayName, phoneNumber, password, passSalt, info.marketingAccepted]
        );

        // 회원가입 작업이 최종적으로 완료되었으므로 인증 번호에 대한 UUID이(가) 만료되어야 함.
        await REDIS_CLIENT.hDel("SignUpAuth", given.uuid);
        const issuedToken = await Auth.issueToken(userId);

        API.success(response, issuedToken);
    }
});