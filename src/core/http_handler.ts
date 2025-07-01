import * as http from "http";
import { HTTPConnection } from "./http_connection";
import { APIError } from "../api/components/api_error";

export type HTTPHandlerCallback = {
    put?: HTTPHandlerListener;
    get?: HTTPHandlerListener;
    head?: HTTPHandlerListener;
    post?: HTTPHandlerListener;
    patch?: HTTPHandlerListener;
    delete?: HTTPHandlerListener;
}

export type HTTPHandlerListener = (
    request: http.IncomingMessage,
    response: http.ServerResponse,
    requestBody: Buffer
) => Promise<void> | void;

export class HTTPHandler {
    constructor(public callback: HTTPHandlerCallback) {}

    /** 주어진 [HTTPConnection]을 사용해 이 핸들러가 요청을 처리합니다. */
    delegate(connection: HTTPConnection) {
        const chunks: Uint8Array[] = [];
        const request = connection.request;
        const response = connection.response;

        request.on("data", chunk => chunks.push(chunk));
        request.on("end", async () => {
            try {
                const method = request?.method?.toLowerCase() as "put" | "get" | "head" | "post" | "patch" | "delete";
                if (method in this.callback && this.callback[method]) {
                    await this.callback[method](request, response, Buffer.concat(chunks));
                    return;
                }

                response.writeHead(405);
                response.end();
            } catch (error) {

                // HTTP 핸들러 측에서 적절한 응답을 위해 고의적으로 예외를 던진 경우.
                if (error instanceof APIError) {
                    response.writeHead(error.code);
                    response.end(error.message);
                } else {
                    response.writeHead(500);
                    response.end(error instanceof Error ? error.message : undefined);
                }
            }
        });
    }
}