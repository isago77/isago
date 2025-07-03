import { HTTPHandler } from "core";
import { API } from "./components/api";
import { z } from "zod";
import { APISchema } from "./components/api_schema";
import { DB_CLIENT } from "..";
import { APIError } from "./components/api_error";

const ProfileRequest = z.object({
    uuid: APISchema.uuid
});

// profile
export const PROFILE_HANDLER = new HTTPHandler({
    get: async (request, response, body) => {
        const given = API.tryParseURL(ProfileRequest, API.urlOf(request));

        // 제 3자가 특정 사용자의 정보를 불러올 수 있는 최소한의 필드가 정의되어 있습니다.
        const fields = [
            "id",
            "email",
            "displayName",
            "profileUrl"
        ];

        const [row] = await DB_CLIENT.query(
            `SELECT ${fields.join(", ")} FROM User WHERE id = ? LIMIT 1`,
            [given.uuid]
        );

        // 유효하지 않은 사용자 UUID의 경우.
        if (!row) throw APIError.INVALID_UUID;

        API.success(response, row);
    }
});