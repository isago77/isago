import { z } from "zod";
import { HTTPHandler } from "core";
import { APISchema } from "./components/api_schema";
import { API } from "./components/api";
import { SMS } from "./components/sms";
import { Test } from "./components/test";
import { APIError } from "./components/api_error";
import { Auth } from "./components/auth";
import { REDIS_CLIENT } from "..";

export const AuthPhoneNumberRequest = z.object({
    phoneNumber: APISchema.phoneNumber
});

// auth/phone-number
export const AUTH_PHONE_NUMBER_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(AuthPhoneNumberRequest, body);

        if (!Test.isPhoneNumber(given.phoneNumber)) {
            throw APIError.INVALID_REQUEST_FORMAT;
        }

        const authUUID = API.createUUID();
        const authNums = Auth.createNumbers();

        // 요청한 전화번호로 인증번호 보내기.
        await SMS.send(given.phoneNumber, `이사GO 인증번호는 [${authNums}]입니다.`);

        const phoneNumber = API.formatToE164(given.phoneNumber);

        await REDIS_CLIENT.multi()
            // 회원가입에 대한 추가적인 인증 작업을 위한 인증 번호를 설정합니다.
            .hSet("PhoneNumberAuth", authUUID, JSON.stringify({phoneNumber, numbers: authNums}))
            // 해당 인증 번호에 대한 만료 시간을 설정합니다. (예시: 10분)
            .hExpire("PhoneNumberAuth", authUUID, Auth.DURATION)
            .exec();

        API.success(response, {uuid: authUUID});
    }
});