import { APIError } from "./api_error";
import * as uuid from "uuid";
import * as http from "http";
import { OutgoingHttpHeaders } from "http2";
import { ServerResponse } from "http";
import { z } from "zod";

export class API {
    // 서버가 직렬화된 데이터를 응답할 때, 사용되는 표준적인 헤더 값입니다.
    static headers: OutgoingHttpHeaders = {
        "content-type": "application/json"
    }

    /**
     * 주어진 JSON 데이터와 주어진 Zod 스키마를 이용해 타입 검증을 수행합니다.
     * 
     * 검증에 실패하면 APIError.INVALID_REQUEST_FORMAT 예외를 발생시켜,
     * 상위 로직에서 일관된 방식으로 에러 처리를 할 수 있도록 합니다.
     */
    static #validate<T extends z.ZodTypeAny>(
        object: T,
        given: Object
    ): z.infer<T> {
        try {
            const parsed = object.safeParse(given);
            if (parsed.success) return parsed.data;

            throw new Error();
        } catch {
            throw APIError.INVALID_REQUEST_FORMAT;
        }
    }

    /**
     * 주어진 JSON 원시 문자열을 역직렬화하고 주어진 Zod 스키마를 이용해 타입 검증을 수행합니다.
     * 
     * 해당 함수는 API 요청 본문(body)의 유효성을 검증하기 위한 목적으로 사용됩니다.
     * 외부에서 전달된 버퍼 형식의 데이터를 JSON으로 변환한 뒤,
     * 타입 안전성을 보장하기 위해 Zod 스키마에 따라 구조를 검증합니다.
     */
    static tryParseJSON<T extends z.ZodTypeAny>(
        object: T,
        given: String | Buffer
    ): z.infer<T> {
        const json = JSON.parse(given.toString());
        return this.#validate(object, json);
    }

    /** 주어진 URL을 객체로 변환하고 주어진 Zod 스키마를 이용해 타입 검증을 수행합니다. */
    static tryParseURL<T extends z.ZodTypeAny>(
        object: T,
        given: URL
    ): z.infer<T> {
        const query = Object.fromEntries(given.searchParams.entries());
        return this.#validate(object, query);
    }

    /** 데이터베이스 또는 서버 측에서 사용되는 표준 UUID를 생성합니다. */
    static createUUID(): string {
        return uuid.v4();
    }

    static success(response: ServerResponse, object: any) {
        response.writeHead(200, API.headers);
        response.end(JSON.stringify(object));
    }

    /** 주어진 HTTP 요청 객체에서 URL 객체를 생성합니다. */
    static urlOf(request: http.IncomingMessage) {
        return new URL(request.url!, `http://${request.headers.host}`);
    }
}