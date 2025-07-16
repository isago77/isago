import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { SQLSearcher } from "../sql/sql_searcher";

const SettlementRequest = z.object({
    sort: APISchema.Search.sort,
    cursor: APISchema.Search.cursor,
    status: z.enum(["pending", "completed", "failed"]).optional(),
});

// settlements
export const SETTLEMENTS_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(SettlementRequest, API.urlOf(request));

        const searcher = new SQLSearcher();
        searcher.add(userId, "a.userId = ?");
        searcher.addIfDefined(given, "status", "a.status = ?");

        const result = await searcher.search(
            "Settlement",
            given.sort,
            given.cursor,
        );

        API.success(response, result);
    })
});