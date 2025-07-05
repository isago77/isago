import { HTTPHandler } from "core";
import { Auth } from "../components/auth";
import z from "zod";
import { APISchema } from "../components/api_schema";
import { API } from "core/src";
import { DB_CLIENT } from "../..";

const StageRequest = z.object({
    fromAddress: APISchema.address,
    toAddress: APISchema.address
});

export const STAGE_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageRequest, body);
        const uuid = API.createUUID();
        const from = JSON.stringify(given.fromAddress);
        const to = JSON.stringify(given.toAddress);

        await DB_CLIENT.query(
            "INSERT INTO Stage(id, userId, fromAddress, toAddress) VALUES(?, ?, ?, ?)",
            [uuid, userId, from, to]
        );

        API.success(response, {uuid});
    }),
    get: Auth.delegate(async (_1, response, _2, userId) => {
        const result = await DB_CLIENT.query(
            "SELECT * FROM Stage WHERE userId = ? ORDER BY createdAt DESC",
            [userId]
        );

        API.success(response, result);
    }),
});