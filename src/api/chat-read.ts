import z from "zod";
import { API, APIError, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { DB_CLIENT } from "..";

const ChatReadRequest = z.object({
    uuid: APISchema.uuid,
});

// chat/read
export const CHAT_READ_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (request, response, body, userId) => {
        const given = API.tryParseJSON(ChatReadRequest, body);
    })
});