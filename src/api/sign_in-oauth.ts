import { z } from "zod";
import { API, APIError, HTTPHandler } from "core";
import axios, { AxiosError } from "axios";
import { DB_CLIENT, REDIS_CLIENT } from "..";
import { Auth } from "./components/auth";

/** OAuth 로그인 시에 제공될 수 있는 사용자의 개인 정보. */
interface OAuthUser {
    userId: string;
    displayName: string;
    phoneNumber: string;
}

/**
 * 카카오 액세스 토큰으로 사용자 정보를 조회하고 아이디를 반환합니다.
 * 요청에 실패하거나 상태 코드가 200이 아닌 경우 예외를 발생시킵니다.
 */
async function userIdByKakao(token: string): Promise<OAuthUser> {
    const result = await axios.get(
        "https://kapi.kakao.com/v2/user/me", {
        headers: {Authorization: `Bearer ${token}`},
        validateStatus: (status) => status == 200
    });

    // 사용자 개인 정보.
    const profile = result.data.kakao_account.profile;

    return {
        userId: result.data.id as string,
        displayName: profile.nickname as string,
        phoneNumber: profile.phone_number as string
    };
}

/**
 * 네이버 액세스 토큰으로 사용자 정보를 조회하고 아이디를 반환합니다.
 * 요청에 실패하거나 상태 코드가 200이 아닌 경우 예외를 발생시킵니다.
 */
async function userIdByNaver(token: string): Promise<OAuthUser> {
    const result = await axios.get(
        "https://openapi.naver.com/v1/nid/me", {
        headers: {Authorization: `Bearer ${token}`},
        validateStatus: (status) => status == 200
    });

    // 사용자 개인 정보.
    const profile = result.data.response;

    return {
        userId: profile.id as string,
        displayName: profile.name,
        phoneNumber: profile.mobile_e164
    }
}

/**
 * Apple 인증 코드로 사용자 정보를 조회하고 아이디를 반환합니다.
 * 요청에 실패하거나 상태 코드가 200이 아닌 경우 예외를 발생시킵니다.
 */
async function userIdByApple(token: string): Promise<OAuthUser> {
    throw SignInOauthError.INVALID_PROVIDER;
}

/** OAuth 분기 처리와 예외 처리를 담당하는 함수입니다. */
async function oauth(token: string, provider: string) {
    try {
        switch (provider) {
            case "kakao": return await userIdByKakao(token);
            case "naver": return await userIdByNaver(token);
            case "apple": return await userIdByApple(token);
            default: throw SignInOauthError.INVALID_PROVIDER;
        }
    } catch (error) {
        if (error instanceof AxiosError) {
            if (error.status == 401) {
                throw SignInOauthError.INVALID_TOKEN;
            }
        }

        throw error;
    }
}

export const SignInOauthRequest = z.object({
    token: z.string(),
    provider: z.string()
});

class SignInOauthError {
    static INVALID_PROVIDER = new APIError("INVALID_PROVIDER", 400);
    static INVALID_TOKEN = new APIError("INVALID_TOKEN", 400);
}

// sign-in/oauth
export const SIGN_IN_OAUTH_HANDLER = new HTTPHandler({
    post: async (_, response, body) => {
        const given = API.tryParseJSON(SignInOauthRequest, body);

        // OAuth에 대한 사용자 아이디를 정의합니다.
        const oauthUser = await oauth(given.token, given.provider);
        const providerUserId = oauthUser.userId;

        const [row] = await DB_CLIENT.query(
            "SELECT userId FROM UserOAuth WHERE providerUserId = ? LIMIT 1",
            [providerUserId]
        );

        // 이미 존재하는 사용자인 경우.
        if (row) {
            const userId = row.userId;
            const issuedToken = await Auth.issueToken(userId);

            API.success(response, {signUpRequired: false, ...issuedToken})
        } else {
            const authUUID = API.createUUID();
            const provider = given.provider;
            const keepData = {
                provider,
                providerUserId,
                displayName: oauthUser.displayName,
                phoneNumber: oauthUser.phoneNumber
            }

            await REDIS_CLIENT.multi()
                // OAuth 회원가입에 대한 추가적인 인증 작업을 위한 인증 번호를 설정합니다.
                .hSet("SignUpOAuth", authUUID, JSON.stringify(keepData))
                // 해당 인증 번호에 대한 만료 시간을 설정합니다. (예시: 10분)
                .hExpire("SignUpOAuth", authUUID, Auth.DURATION)
                .exec();

            API.success(response, {
                signUpRequired: true,
                uuid: authUUID,
                needsDisplayName: oauthUser.displayName == null,
                needsPhoneNumber: oauthUser.phoneNumber == null,
            });
        }
    }
});