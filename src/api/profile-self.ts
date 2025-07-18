import { z } from "zod";
import { DB_CLIENT } from "..";
import { API, APIError, HTTPHandler } from "core";
import { Auth, AuthProvider } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { SQLModifier } from "../sql/sql_modifer";
import { SQLTransaction } from "../sql/sql_transaction";
import { Secure } from "./components/secure";

const Link = z.object({
    label: z.string().nullable(),
    url: APISchema.url
});

const AccountDetails = z.object({
    accountType: z.string(),
    accountNumber: z.string(),
});

const ProfileSelfPatchRequest = z.object({
    displayName: APISchema.Profile.displayName.optional(),
    profileUrl: APISchema.url.optional(),
    phoneNumberToken: APISchema.token.optional(),
    marketingAccepted: z.boolean().optional(),

    // 관리자, 이사업체, 견적 방문자용.
    introduction: z.string().max(1024).optional(),
    bannerUrl: APISchema.url.optional(),
    links: z.array(Link).optional(),
    address: APISchema.address.optional(),
    contactAs: APISchema.phoneNumber.optional(),
    serviceAreas: z.array(z.string()).optional(),
    accountDetails: AccountDetails.optional(),
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
            "a.role",
            `IFNULL(b.provider, '${AuthProvider.self}') AS provider`
        ];

        // 필수 사용자 정보를 조회합니다.
        const [row] = await DB_CLIENT.query(
            `SELECT ${fields.join(", ")} FROM User a LEFT JOIN UserOAuth b ON b.userId = a.id WHERE id = ? LIMIT 1`,
            [userId]
        );

        let result = row;

        // 조회된 역할에 따라 추가적으로 부가적인 사용자 정보를 조회해야 할 때.
        if (result.role != null) {
            const fields = [
                `introduction`,
                `bannerUrl`,
                `links`,
                `address`,
                `contactAs`,
                `serviceAreas`,
                `accountDetails`,
            ];

            const [row] = await DB_CLIENT.query(
                `SELECT ${fields.join(", ")} FROM UserDetails WHERE userId = ? LIMIT 1`,
                [userId]
            );

            // 데이터 병합.
            if (row) result = {...result, ...row};
        }

        // 암호화되었던 사용자의 전화번호를 복호화합니다.
        result.phoneNumber = Secure.decrypt(result.phoneNumber);

        // 암호화되었던 사용자의 계좌 상세 정보를 복호화합니다.
        if (result.accountDetails) {
            result.accountDetails = JSON.parse(Secure.decrypt(result.accountDetails));
        }

        API.success(response, result);
    }),
    patch: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(ProfileSelfPatchRequest, body);

        await SQLTransaction.perform(async (db) => {
            { // 필수 사용자 정보
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

                    // 개인 정보인 사용자의 전화번호를 암호화하여 이를 영구 저장하도록 합니다.
                    const encryptedPhoneNumber = JSON.stringify(Secure.encrypt(phoneNumber));

                    modifier.add("phoneNumber", encryptedPhoneNumber);
                }

                await modifier.safety(async () => {
                    await db.query(
                        `UPDATE User SET ${modifier.setter} WHERE id = ?`,
                        [...modifier.values, userId]
                    );
                });
            }

            { // 부가적인 사용자 정보
                const modifier = new SQLModifier();
                modifier.addIfDefined(given, "introduction");
                modifier.addIfDefined(given, "bannerUrl");
                modifier.addIfDefined(given, "links");
                modifier.addIfDefined(given, "address")
                modifier.addIfDefined(given, "serviceAreas");

                if (given.accountDetails) {
                    // 개인 정보인 사용자의 전화번호를 암호화하여 이를 영구 저장하도록 합니다.
                    const encryptedData = JSON.stringify(
                        Secure.encrypt(JSON.stringify(given.accountDetails))
                    );

                    modifier.add("accountDetails", encryptedData)
                }

                // 검증된 사용자(e.g. 업체, 견적 방문자, 관리자)이기 때문에 별도의 인증은 필요 없음.
                if (given.contactAs) {
                    modifier.add("contactAs", API.formatToE164(given.contactAs));
                }

                await modifier.safety(async () => {
                    await db.query(
                        `UPDATE IGNORE UserDetails SET ${modifier.setter} WHERE userId = ?`,
                        [...modifier.values, userId]
                    )
                });
            }
        });

        API.success(response, undefined);
    })
});