import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import z from "zod";
import { APISchema } from "../components/api_schema";
import { DB_CLIENT } from "../..";

const GetRequest = z.object({
    stageId: APISchema.uuid,
});

// stage/mover/request/count
export const STAGE_MOVER_REQUEST_COUNT_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _1, _2) => {
        const given = API.tryParseURL(GetRequest, API.urlOf(request));

        const [row] = await DB_CLIENT.query(
            "SELECT COUNT(*) AS count FROM MoverRequest WHERE stageId = ?",
            [given.stageId]
        );

        API.success(response, {count: Number(row.count)});
    })
});