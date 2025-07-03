import { HTTPHandler } from "../core/http_handler";
import { z } from "zod";
import { APILength } from "./components/api_length";
import { API } from "./components/api";
import { Test } from "./components/test";
import { APIError } from "./components/api_error";
import { DB_CLIENT, REDIS_CLIENT } from "..";
import { Mail } from "./components/mail";
import { Auth } from "./components/auth";

export const SignUpRequest = z.object({
    email: z.string().max(APILength.email),
    displayName: z.string().min(2).max(15),
    phoneNumberToken: z.string()
        .min(APILength.token)
        .max(APILength.token),
    password: z.string(),
    marketingAccepted: z.boolean(),
    profileUrl: z.string().max(APILength.url).optional()
});

class SignUpError {
    static INVALID_EMAIL = new APIError("INVALID_EMAIL", 400); // 이메일 전송 실패.
    static INVALID_EMAIL_FORMAT = new APIError("INVALID_EMAIL_FORMAT", 400); // 유효하지 않은 이메일 형식
    static ALREADY_EXISTS_EMAIL = new APIError("ALREADY_EXISTS_EMAIL", 400); // 이미 해당 이메일이 존재함.
}

export async function validSignUpRequest(given: z.infer<typeof SignUpRequest>) {
    if (!Test.isEmail(given.email)) {
        throw SignUpError.INVALID_EMAIL_FORMAT;
    }

    // 사용자가 요청한 이메일이 이미 존재하는지 확인.
    const result = await DB_CLIENT.query(
        "SELECT 1 FROM `User` WHERE email = ? LIMIT 1",
        [given.email]
    );

    if (result.length > 0) {
        throw SignUpError.ALREADY_EXISTS_EMAIL;
    }
}

// sign-up
export const SIGN_UP_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(SignUpRequest, body);
        await validSignUpRequest(given);

        const authUUID = API.createUUID();
        const authNums = Auth.createNumbers();

        try {
            await Mail.sendAuthNumbers("이사고 회원가입을 위한 인증 번호", given.email, authNums);
        } catch (error) {
            throw SignUpError.INVALID_EMAIL;
        }

        await REDIS_CLIENT.multi()
            // 회원가입에 대한 추가적인 인증 작업을 위한 인증 번호를 설정합니다.
            .hSet("SignUpAuth", authUUID, JSON.stringify({...given, ...{numbers: authNums}}))
            // 해당 인증 번호에 대한 만료 시간을 설정합니다. (예시: 10분)
            .hExpire("SignUpAuth", authUUID, Auth.DURATION)
            .exec();

        API.success(response, {uuid: authUUID});
    }
});