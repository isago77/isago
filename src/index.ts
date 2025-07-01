import http from "http";
import { config } from "dotenv";
import { createPool } from "mariadb";
import { createClient } from "redis";
import { HTTPRouter } from "./core/http_router";
import { SIGN_UP_HANDLER } from "./api/sign_up";
import { HTTPConnection } from "./core/http_connection";
import { SIGN_UP_AUTH_HANDLER } from "./api/sign_up-auth";
import { SIGN_IN_REISSUE_HANDLER } from "./api/sign_in-reissue";
import { SIGN_IN_HANDLER } from "./api/sign_in";
import { RESET_PASSWORD_HANDLER } from "./api/reset_password";
import { RESET_PASSWORD_AUTH_HANDLER } from "./api/reset_password-auth";
import { SIGN_IN_OAUTH_HANDLER } from "./api/sign_in-oauth";
import { SIGN_UP_OAUTH_HANDLER } from "./api/sign_up-oauth";

/** .env 파일의 환경 변수를 process.env에 로드. */
config();

export const DB_CLIENT = createPool({
    host: process.env.MARIADB_HOST,
    user: process.env.MARIADB_USER,
    password: process.env.MARIADB_PASSWORD,
    database: process.env.MARIADB_DATABASE,
    connectionLimit: parseInt(process.env.MARIADB_POOL_LIMIT!),
});

export const REDIS_CLIENT = createClient({
    socket: {
        // 외부 포트를 기준으로 (참고: 내부 포트는 기본 redis 포트입니다.)
        port: parseInt(process.env.REDIS_PORT as string)
    },
    password: process.env.REDIS_PASSWORD
});

// sign-up
// sign-up/auth
// sign-in
// sign-in/reissue
// reset-password
// reset-password/auth
const HTTP_ROUTER = new HTTPRouter("/", undefined, [
    new HTTPRouter("sign-up", SIGN_UP_HANDLER, [
        new HTTPRouter("auth", SIGN_UP_AUTH_HANDLER),
        new HTTPRouter("oauth", SIGN_UP_OAUTH_HANDLER),
    ]),
    new HTTPRouter("sign-in", SIGN_IN_HANDLER, [
        new HTTPRouter("reissue", SIGN_IN_REISSUE_HANDLER),
        new HTTPRouter("oauth", SIGN_IN_OAUTH_HANDLER)
    ]),
    new HTTPRouter("reset-password", RESET_PASSWORD_HANDLER, [
        new HTTPRouter("auth", RESET_PASSWORD_AUTH_HANDLER)
    ])
]);

const server = http.createServer(async (request, response) => {
    if (request.url === undefined) return;

    try {
        HTTP_ROUTER.perform(new HTTPConnection(
            request.url.split("/"),
            request,
            response
        ));
    } catch (error) {
        response.writeHead(500);
        response.end(error instanceof Error ? error.message : undefined);
    }
});

server.listen(8080, undefined, undefined, () => {
    REDIS_CLIENT.connect();
});
