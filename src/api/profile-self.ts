import { DB_CLIENT } from "..";
import { HTTPHandler } from "../core/http_handler";
import { API } from "./components/api";
import { Auth } from "./components/auth";

export const PROFILE_SELF_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (_, response, body, userId) => {
        // 사용자가 자기 자신에 대한 정보를 불러올 수 있는 최소한의 필드가 정의되어 있습니다.
        const fields = [
            "id",
            "email",
            "displayName",
            "phoneNumber",
            "marketingAccepted",
            "profileUrl",
        ];

        const [row] = await DB_CLIENT.query(
            `SELECT ${fields.join(", ")} FROM User WHERE id = ? LIMIT 1`,
            [userId]
        );

        API.success(response, row);
    })
});