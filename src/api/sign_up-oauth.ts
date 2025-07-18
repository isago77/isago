import { z } from "zod";
import { API, APIError, HTTPHandler } from "core";
import { APISchema } from "./components/api_schema";
import { REDIS_CLIENT } from "..";
import { Auth } from "./components/auth";
import { SQLTransaction } from "../sql/sql_transaction";
import { Secure } from "./components/secure";

/** 서버 측에서 정의한 OAuth 회원가입 요청 정보에 대한 데이터 형태. */
const SignUpOAuth = z.object({
    provider: z.string(),
    providerUserId: z.union([z.string(), z.number()]),
    displayName: z.string().optional(),
    phoneNumber: z.string().optional(),
});

const SignUpOAuthRequest = z.object({
    uuid: APISchema.uuid,
    phoneNumberToken: APISchema.token.optional(),
    displayName: APISchema.Profile.displayName.optional(),
    marketingAccepted: z.boolean()
});

// sign-up/oauth
export const SIGN_UP_OAUTH_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(SignUpOAuthRequest, body);

        const rawInfo = await REDIS_CLIENT.hGet("SignUpOAuth", given.uuid);

        // 주어진 UUID이(가) 유효하지 않은 경우.
        if (!rawInfo) throw APIError.INVALID_UUID;

        const info = API.tryParseJSON(SignUpOAuth, rawInfo);
        const displayName = info.displayName ?? given.displayName;
        let phoneNumber = info.phoneNumber ?? given.phoneNumberToken;

        // OAuth 측에서 사용자의 개인 정보가 제공되지 않았으나 추가 회원가입 절차에서도 제공되지 않았을 경우.
        if (!displayName || !phoneNumber) {
            throw APIError.INVALID_REQUEST_FORMAT;
        }

        // 전화번호 토큰을 실제 값인 국제 전화번호 형태로 치환.
        if (given.phoneNumberToken != null) {
            phoneNumber = await Auth.phoneNumberOf(phoneNumber);
        }

        // 전화번호 토큰이 유효하지 않은 경우.
        if (!phoneNumber) {
            throw APIError.INVALID_PHONE_NUMBER_TOKEN;
        }

        const userId = API.createUUID();
        const fields = [
            "id",
            "displayName",
            "phoneNumber",
            "marketingAccepted"
        ];

        // 개인 정보인 사용자의 전화번호를 암호화하여 이를 영구 저장하도록 합니다.
        const encryptedPhoneNumber = JSON.stringify(Secure.encrypt(phoneNumber));

        await SQLTransaction.perform(async (db) => {
            await db.query(
                `INSERT INTO User(${fields.join(", ")}) VALUES(${fields.map(_ => "?").join(", ")})`,
                [userId, displayName, encryptedPhoneNumber, given.marketingAccepted]
            );

            await db.query(
                `INSERT INTO UserOAuth(userId, provider, providerUserId) VALUES(?, ?, ?)`,
                [userId, info.provider, info.providerUserId]
            );
        });

        // OAuth 회원가입 작업이 최종적으로 완료되었으므로 UUID이(가) 만료되어야 함.
        REDIS_CLIENT.hDel("SignUpOAuth", given.uuid);
        const issuedToken = await Auth.issueToken(userId);

        API.success(response, issuedToken);
    }
});