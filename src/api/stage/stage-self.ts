import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { DB_CLIENT } from "../..";

// stage/self
export const STAGE_SELF_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (_1, response, _2, userId) => {
        const result = await DB_CLIENT.query(
            "SELECT * FROM Stage WHERE userId = ? ORDER BY createdAt DESC",
            [userId]
        );

        API.success(response, result);
    }),
});