import { z } from "zod";
import { HTTPHandler } from "../core/http_handler";
import { APILength } from "./components/api_length";
import { API } from "./components/api";
import { REDIS_CLIENT } from "..";
import { APIError } from "./components/api_error";

const SignOutRequest = z.object({
    accessToken: z.string()
        .min(APILength.token)
        .max(APILength.token)
        .optional(),

    refreshToken: z.string()
        .min(APILength.token)
        .max(APILength.token)
        .optional()
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