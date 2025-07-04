import { z } from "zod";
import { API, APIError, HTTPHandler } from "core";
import { REDIS_CLIENT } from "..";
import { Auth } from "./components/auth";
import { APISchema } from "./components/api_schema";

const SignInReissueRequest = z.object({
    refreshToken: APISchema.token
});

class SignInReissueError {
    static INVALID_REFRESH_TOKEN = new APIError("INVALID_REFRESH_TOKEN", 400);
}

// sign-in/reissue
export const SIGN_IN_REISSUE_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(SignInReissueRequest, body)

        // 유효한 리프레시 토큰이라면 사용자 아이디가 정의됨.
        const userId = await REDIS_CLIENT.hGet("RefreshToken", given.refreshToken);

        // 주어진 리프레시 토큰이 유효하지 않은 경우.
        if (!userId) {
            throw SignInReissueError.INVALID_REFRESH_TOKEN;
        }

        const issuedToken = await Auth.issueToken(userId);

        // 새로운 토큰 발급 이후, 사용된 리프레시 토큰을 만료시킴.
        await REDIS_CLIENT.hDel("RefreshToken", given.refreshToken);

        API.success(response, issuedToken);
    }
});