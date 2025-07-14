// 웹소켓 관련 코드 초기화.
import "./socket/chat";

import http from "http";
import { config } from "dotenv";
import { createPool } from "mariadb";
import { createClient } from "redis";
import { SIGN_UP_HANDLER } from "./api/sign_up";
import { SIGN_IN_REISSUE_HANDLER } from "./api/sign_in-reissue";
import { SIGN_IN_HANDLER } from "./api/sign_in";
import { RESET_PASSWORD_HANDLER } from "./api/reset_password";
import { RESET_PASSWORD_AUTH_HANDLER } from "./api/reset_password-verify";
import { SIGN_IN_OAUTH_HANDLER } from "./api/sign_in-oauth";
import { SIGN_UP_OAUTH_HANDLER } from "./api/sign_up-oauth";
import { PROFILE_HANDLER } from "./api/profile";
import { PROFILE_SELF_HANDLER } from "./api/profile-self";
import { SIGN_OUT_HANDLER } from "./api/sign_out";
import { AUTH_PHONE_NUMBER_HANDLER } from "./api/auth-phone_number";
import { AUTH_PHONE_NUMBER_VERIFY_HANDLER } from "./api/auth-phone_number-verify";
import { HTTPConnection, HTTPRouter } from "core";
import { IMAGE_PROFILE_HANDLER } from "./api/image-profile";
import { SIGN_UP_VERIFY_HANDLER } from "./api/sign_up-verify";
import { PROFILE_ROLE_HANDLER } from "./api/profile-role";
import { ISSUE_ROLE_SERIAL_HANDLER } from "./api/issue-role_serial";
import { STAGE_HANDLER } from "./api/stage/stage";
import { STAGE_SEARCH_HANDLER } from "./api/stage/stage-search";
import { STAGE_ESTIMATOR_HANDLER } from "./api/stage/stage-estimator";
import { STAGE_ESTIMATOR_DONE_HANDLER } from "./api/stage/stage-estimator-done";
import { STAGE_ESTIMATOR_SELF_HANDLER } from "./api/stage/stage-estimator-self";
import { STAGE_ESTIMATOR_AVAILABLE_HANDLER } from "./api/stage/stage-estimator-available";
import { STAGE_ESTIMATOR_AVAILABLE_SEARCH_HANDLER } from "./api/stage/stage-estimator-available-search";
import { STAGE_MOVER_REQUEST_HANDLER } from "./api/stage/stage-mover-request";
import { STAGE_SELF_HANDLER } from "./api/stage/stage-self";
import { STAGE_MOVER_PAYMENT_HANDLER } from "./api/stage/stage-mover-payment";
import { STAGE_MOVER_PAYMENT_CONFIRM_HANDLER } from "./api/stage/stage-mover-payment-confirm";
import { IMAGE_ESTIMATOR_HANDLER } from "./api/image-estimator";
import { STAGE_MOVER_REQUEST_COUNT_HANDLER } from "./api/stage/stage-mover-request-count";
import { IMAGE_BANNER_HANDLER } from "./api/image-banner";
import { STAGE_CANCEL_HANDLER } from "./api/stage/stage-cancel";
import { STAGE_MOVER_HANDLER } from "./api/stage/stage-mover";
import { STAGE_MOVER_DONE_HANDLER } from "./api/stage/stage-mover-done";
import { STAGE_MOVER_SELF_HANDLER } from "./api/stage/stage-mover-self";
import { CHAT_HANDLER } from "./api/chat";
import { CHAT_ACTIVE_HANDLER } from "./api/chat-active";
import { CHAT_MESSAGE_HANDLER } from "./api/chat-message";
import { CHAT_READ_HANDLER } from "./api/chat-read";
import { FIREBASE_TOKEN_HANDLER } from "./api/firebase-token";

/** .env 파일의 환경 변수를 process.env에 로드. */
config();

export const DB_CLIENT = createPool({
    host: process.env.MARIADB_HOST,
    user: process.env.MARIADB_USER,
    port: parseInt(process.env.MARIADB_PORT!),
    password: process.env.MARIADB_PASSWORD,
    database: process.env.MARIADB_DATABASE,
    connectionLimit: parseInt(process.env.MARIADB_POOL_LIMIT!),
    dateStrings: true,
    typeCast: (field, next) => {
        // TINYINT(1)은 사실상 Boolean 이므로 이를 변환.
        if (field.type == "TINY" && field.columnLength == 1) {
            return field.string() == "1";
        }

        return next();
    }
});

export const REDIS_CLIENT = createClient({
    socket: {
        // 외부 포트를 기준으로 (참고: 내부 포트는 기본 redis 포트입니다.)
        port: parseInt(process.env.REDIS_PORT as string)
    },
    password: process.env.REDIS_PASSWORD
});

// 자세한 내용은 API 문서를 참고하세요.
const HTTP_ROUTER = new HTTPRouter("/", undefined, [
    new HTTPRouter("sign-up", SIGN_UP_HANDLER, [
        new HTTPRouter("verify", SIGN_UP_VERIFY_HANDLER),
        new HTTPRouter("oauth", SIGN_UP_OAUTH_HANDLER),
    ]),
    new HTTPRouter("sign-in", SIGN_IN_HANDLER, [
        new HTTPRouter("reissue", SIGN_IN_REISSUE_HANDLER),
        new HTTPRouter("oauth", SIGN_IN_OAUTH_HANDLER)
    ]),
    new HTTPRouter("sign-out", SIGN_OUT_HANDLER),
    new HTTPRouter("reset-password", RESET_PASSWORD_HANDLER, [
        new HTTPRouter("verify", RESET_PASSWORD_AUTH_HANDLER)
    ]),
    new HTTPRouter("auth", undefined, [
        new HTTPRouter("phone-number", AUTH_PHONE_NUMBER_HANDLER, [
            new HTTPRouter("verify", AUTH_PHONE_NUMBER_VERIFY_HANDLER)
        ]),
    ]),
    new HTTPRouter("profile", PROFILE_HANDLER, [
        new HTTPRouter("self", PROFILE_SELF_HANDLER),
        new HTTPRouter("role", PROFILE_ROLE_HANDLER),
    ]),
    new HTTPRouter("image", PROFILE_HANDLER, [
        new HTTPRouter("profile", IMAGE_PROFILE_HANDLER),
        new HTTPRouter("estimator", IMAGE_ESTIMATOR_HANDLER),
        new HTTPRouter("banner", IMAGE_BANNER_HANDLER)
    ]),
    new HTTPRouter("issue", undefined, [
        new HTTPRouter("role-serial", ISSUE_ROLE_SERIAL_HANDLER)
    ]),
    new HTTPRouter("stage", STAGE_HANDLER, [
        new HTTPRouter("self", STAGE_SELF_HANDLER),
        new HTTPRouter("search", STAGE_SEARCH_HANDLER),
        new HTTPRouter("cancel", STAGE_CANCEL_HANDLER),
        new HTTPRouter("estimator", STAGE_ESTIMATOR_HANDLER, [
            new HTTPRouter("done", STAGE_ESTIMATOR_DONE_HANDLER),
            new HTTPRouter("self", STAGE_ESTIMATOR_SELF_HANDLER),
            new HTTPRouter("available", STAGE_ESTIMATOR_AVAILABLE_HANDLER, [
                new HTTPRouter("search", STAGE_ESTIMATOR_AVAILABLE_SEARCH_HANDLER)
            ]),
        ]),
        new HTTPRouter("mover", STAGE_MOVER_HANDLER, [
            new HTTPRouter("request", STAGE_MOVER_REQUEST_HANDLER, [
                new HTTPRouter("count", STAGE_MOVER_REQUEST_COUNT_HANDLER)
            ]),
            new HTTPRouter("payment", STAGE_MOVER_PAYMENT_HANDLER, [
                new HTTPRouter("confirm", STAGE_MOVER_PAYMENT_CONFIRM_HANDLER)
            ]),
            new HTTPRouter("done", STAGE_MOVER_DONE_HANDLER),
            new HTTPRouter("self", STAGE_MOVER_SELF_HANDLER),
        ]),
    ]),
    new HTTPRouter("chat", CHAT_HANDLER, [
        new HTTPRouter("read", CHAT_READ_HANDLER),
        new HTTPRouter("active", CHAT_ACTIVE_HANDLER),
        new HTTPRouter("message", CHAT_MESSAGE_HANDLER),
    ]),
    new HTTPRouter("firebase", undefined, [
        new HTTPRouter("token", FIREBASE_TOKEN_HANDLER)
    ])
]);

export const server = http.createServer(async (request, response) => {
    if (request.url === undefined) return;

    try {
        HTTP_ROUTER.perform(HTTPConnection.fromServer(
            request,
            response,
        ));
    } catch (error) {
        response.writeHead(500);
        response.end(error instanceof Error ? error.message : undefined);
    }
});

server.listen(8080, undefined, undefined, () => {
    REDIS_CLIENT.connect();
});