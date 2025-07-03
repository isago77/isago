import { z } from "zod";
import { HTTPHandler } from "../core/http_handler";
import { APILength } from "./components/api_length";
import { API } from "./components/api";
import { Auth } from "./components/auth";
import { REDIS_CLIENT } from "..";
import { AuthPhoneNumberRequest } from "./auth-phone_number";
import { APIError } from "./components/api_error";

const PhoneNumberAuth = AuthPhoneNumberRequest.extend({
    numbers: z.string()
        .min(Auth.LENGTH)
        .max(Auth.LENGTH)
});

const AuthPhoneNumberVerifiyRequest = z.object({
    uuid: z.string()
        .min(APILength.uuid)
        .max(APILength.uuid),

    numbers: z.string()
        .min(Auth.LENGTH)
        .max(Auth.LENGTH)
});

class AuthPhoneNumberVerifyError {
    /** 유효하지 않은 인증 번호를 요청했을 때. */
    static INVALID_AUTH_NUMBERS = new APIError("INVALID_AUTH_NUMBERS", 400);
}

// auth/phone-number/verify
export const AUTH_PHONE_NUMBER_VERIFY_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(AuthPhoneNumberVerifiyRequest, body);

        const rawInfo = await REDIS_CLIENT.hGet("PhoneNumberAuth", given.uuid);
        if (!rawInfo) throw APIError.INVALID_UUID;

        const info = API.tryParseJSON(PhoneNumberAuth, rawInfo);

        // 주어진 인증 번호가 기존 할당된 인증 번호와 일치하는지 확인.
        if (info.numbers != given.numbers) {
            throw AuthPhoneNumberVerifyError.INVALID_AUTH_NUMBERS;
        }

        const token = Auth.createToken();

        await REDIS_CLIENT.multi()
            // 전화번호를 통한 인증 절차가 최종적으로 완료되었으므로 인증 번호에 대한 UUID이(가) 만료되어야 함.
            .hDel("PhoneNumberAuth", given.uuid)
            // 전화번호에 대한 추가적인 인증 작업을 위한 토큰을 설정합니다.
            .hSet("PhoneNumberToken", token, info.phoneNumber)
            // 해당 토큰에 대한 만료 시간을 설정합니다. (예시: 10분)
            .hExpire("PhoneNumberToken", token, Auth.DURATION)
            .exec();

        API.success(response, {token});
    }
});