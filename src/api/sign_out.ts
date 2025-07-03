import { z } from "zod";
import { HTTPHandler } from "core";
import { APISchema } from "./components/api_schema";
import { API } from "./components/api";
import { REDIS_CLIENT } from "..";
import { APIError } from "./components/api_error";

const SignOutRequest = z.object({
    accessToken: APISchema.token.optional(),
    refreshToken: APISchema.token.optional()
});

class SignOutError {
    static INVALID_ACCESS_TOKEN = new APIError("INVALID_ACCESS_TOKEN", 400);
    static INVALID_REFRESH_TOKEN = new APIError("INVALID_REFRESH_TOKEN", 400);
}

// sign-out
export const SIGN_OUT_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(SignOutRequest, body);

        let error: APIError | undefined;

        if (given.accessToken) {
            const count = await REDIS_CLIENT.hDel("AccessToken", given.accessToken);

            // 유효하지 않은 엑세스 토큰일 경우.
            if (count == 0) {
                error = SignOutError.INVALID_ACCESS_TOKEN;
            }
        }

        if (given.refreshToken) {
            const count = await REDIS_CLIENT.hDel("RefreshToken", given.refreshToken);

            // 유효하지 않은 리프레시 토큰일 경우.
            if (count == 0) {
                error = SignOutError.INVALID_REFRESH_TOKEN;
            }
        }

        if (error) throw error;

        API.success(response, undefined);
    }
});