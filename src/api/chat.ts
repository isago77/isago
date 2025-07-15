import z from "zod";
import { API, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { DB_CLIENT } from "..";
import { SQLSearcher } from "../sql/sql_searcher";

/** 클라이언트 측에서 한 번에 조회할 수 있는 메세지들의 개수. */
const CHAT_SEARCH_MAX_COUNT = 30;

const ChatRequest = z.object({
    targetId: APISchema.uuid,
    cursor: APISchema.Search.cursor,
});

export const CHAT_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (request, response, _, userId) => {
        const given = API.tryParseURL(ChatRequest, API.urlOf(request));

        const limitCount = CHAT_SEARCH_MAX_COUNT + 1;
        const rows: any[] = await DB_CLIENT.query(
            `
                SELECT * FROM Chat 
                WHERE ((senderId = ? AND targetId = ?)
                    OR (senderId = ? AND targetId = ?))
                ${given.cursor != null ? "AND \`cursor\` < ?" : ""}
                ORDER BY \`cursor\` DESC
                LIMIT ${limitCount}
            `,
            [userId, given.targetId, given.targetId, userId, given.cursor].filter(Boolean)
        );

        const result = SQLSearcher.createResult(rows, "cursor", CHAT_SEARCH_MAX_COUNT);

        API.success(response, result);
    })
});