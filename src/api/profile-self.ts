import { z } from "zod";
import { DB_CLIENT } from "..";
import { API, APIError, HTTPHandler } from "core";
import { Auth, AuthProvider } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { SQLModifier } from "../sql/sql_modifer";

const ProfileSelfPatchRequest = z.object({
    displayName: APISchema.Profile.displayName.optional(),
    profileUrl: APISchema.url.optional(),
    phoneNumberToken: APISchema.token.optional(),
    marketingAccepted: z.boolean().optional()
});

// profile/self
export const PROFILE_SELF_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (_, response, _2, userId) => {
        // 사용자가 자기 자신에 대한 정보를 불러올 수 있는 최소한의 필드가 정의되어 있습니다.
        const fields = [
            "a.id",
            "a.email",
            "a.displayName",
            "a.phoneNumber",
            "a.marketingAccepted",
            "a.profileUrl",
            `IFNULL(b.provider, '${AuthProvider.self}') AS provider`
        ];

        const [row] = await DB_CLIENT.query(
            `SELECT ${fields.join(", ")} FROM User a LEFT JOIN UserOAuth b ON b.userId = a.id WHERE id = ? LIMIT 1`,
            [userId]
        );

        API.success(response, row);
    }),
    patch: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(ProfileSelfPatchRequest, body);

        const modifier = new SQLModifier();
        modifier.addIfDefined(given, "displayName");
        modifier.addIfDefined(given, "profileUrl");
        modifier.addIfDefined(given, "marketingAccepted");

        if (given.phoneNumberToken != null) {
            const phoneNumber = await Auth.phoneNumberOf(given.phoneNumberToken);

            // 유효하지 않은 전화번호 토큰일 경우.
            if (!phoneNumber) {
                throw APIError.INVALID_PHONE_NUMBER_TOKEN;
            }

            modifier.add("phoneNumber", phoneNumber);
        }

        await modifier.safety(async () => {
            await DB_CLIENT.query(
                `UPDATE User SET ${modifier.setter} WHERE id = ?`,
                [...modifier.values, userId]
            );
        });

        API.success(response, undefined);
    })
});