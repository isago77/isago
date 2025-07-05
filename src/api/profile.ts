import { API, APIError, HTTPHandler } from "core";
import { z } from "zod";
import { APISchema } from "./components/api_schema";
import { DB_CLIENT } from "..";

const ProfileRequest = z.object({
    uuid: APISchema.uuid
});

// profile
export const PROFILE_HANDLER = new HTTPHandler({
    get: async (request, response, _) => {
        const given = API.tryParseURL(ProfileRequest, API.urlOf(request));

        // 제 3자가 특정 사용자의 정보를 불러올 수 있는 최소한의 필드가 정의되어 있습니다.
        const fields = [
            "id",
            "email",
            "displayName",
            "profileUrl",
            "role"
        ];

        const [row] = await DB_CLIENT.query(
            `SELECT ${fields.join(", ")} FROM User WHERE id = ? LIMIT 1`,
            [given.uuid]
        );

        // 유효하지 않은 사용자 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        const userId = row.id;
        let result = row;

        // 조회된 역할에 따라 추가적으로 부가적인 사용자 정보를 조회해야 할 때.
        if (result.role != null) {
            const fields = [
                `introduction`,
                `bannerUrl`,
                `links`,
                `contactAs`,
                `serviceAreas`,
            ];

            const [row] = await DB_CLIENT.query(
                `SELECT ${fields.join(", ")} FROM UserDetails WHERE userId = ? LIMIT 1`,
                [userId]
            );

            // 데이터 병합.
            if (row) result = {...result, ...row};
        }

        API.success(response, result);
    }
});