import { z } from "zod";
import { HTTPHandler } from "../core/http_handler";
import { APILength } from "./components/api_length";
import { API } from "./components/api";
import { DB_CLIENT, REDIS_CLIENT } from "..";
import { APIError } from "./components/api_error";
import { Auth } from "./components/auth";

/** 서버 측에서 정의한 OAuth 회원가입 요청 정보에 대한 데이터 형태. */
const SignUpOAuth = z.object({
    provider: z.string(),
    providerUserId: z.union([z.string(), z.number()])
});

const SignUpOAuthRequest = z.object({
    uuid: z.string()
        .min(APILength.uuid)
        .max(APILength.uuid),

    displayName: z.string().max(15),
    phoneNumber: z.string().max(APILength.phoneNumber),
    marketingAccepted: z.boolean()
});

// sign-up/oauth
export const SIGN_UP_OAUTH_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParse(SignUpOAuthRequest, body);

        const rawInfo = await REDIS_CLIENT.hGet("SignUpOAuth", given.uuid);

        // 주어진 UUID이(가) 유효하지 않은 경우.
        if (!rawInfo) throw APIError.INVALID_UUID;

        const info = API.tryParse(SignUpOAuth, rawInfo);
        const userId = API.createUUID();
        const fields = [
            "id",
            "displayName",
            "phoneNumber",
            "marketingAccepted"
        ];

        const db = await DB_CLIENT.getConnection();
        await db.query("START TRANSACTION")
        await db.query(
            `INSERT INTO User(${fields.join(", ")}) VALUES(${fields.map(_ => "?").join(", ")})`,
            [userId, given.displayName, given.phoneNumber, given.marketingAccepted]
        );
        await db.query(
            `INSERT INTO UserOAuth(userId, provider, providerUserId) VALUES(?, ?, ?)`,
            [userId, info.provider, info.providerUserId]
        );
        await db.query("COMMIT");
        await db.end();

        // OAuth 회원가입 작업이 최종적으로 완료되었으므로 UUID이(가) 만료되어야 함.
        REDIS_CLIENT.hDel("SignUpOAuth", given.uuid);
        const issuedToken = await Auth.issueToken(userId);

        API.success(response, issuedToken);
    }
});