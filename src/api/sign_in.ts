import { z } from "zod";
import { HTTPHandler } from "../core/http_handler";
import { API } from "./components/api";
import { APILength } from "./components/api_length";
import { DB_CLIENT } from "..";
import { APIError } from "./components/api_error";
import { Auth } from "./components/auth";

const SignInRequest = z.object({
    email: z.string().max(APILength.email),
    password: z.string()
});

class SignInError {
    static INVALID_EMAIL = new APIError("INVALID_EMAIL", 400);
    static INVALID_PASSWORD = new APIError("INVALID_PASSWORD", 400);
}

// sign-in
export const SIGN_IN_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParse(SignInRequest, body);

        const [row] = await DB_CLIENT.query(
            "SELECT id, password, passwordSalt FROM User WHERE email = ? LIMIT 1",
            [given.email]
        );

        // 유효하지 않은 이메일일 경우.
        if (!row) throw SignInError.INVALID_EMAIL;

        const userId = row.id;
        const password = row.password;
        const passSalt = row.passwordSalt;
        const givenPassword = Auth.hashAsBase64("sha512", given.password + passSalt);

        // 유효하지 않은 비밀번호일 경우.
        if (password != givenPassword) {
            throw SignInError.INVALID_PASSWORD;
        }

        const issuedToken = await Auth.issueToken(userId);
        API.success(response, issuedToken)
    }
});