import { z } from "zod";
import { Auth } from "./auth";
import { APILength } from "./api_length";
import { Test } from "./test";

/** API에서 공통적으로 사용하는 데이터의 유효성 스키마 정의. */
export namespace APISchema {
    export const uuid = z.string()
        .min(APILength.uuid)
        .max(APILength.uuid);

    /** 이메일, 전화번호 인증과 같은 인증 번호. */
    export const authNumbers = z.string()
        .min(Auth.LENGTH)
        .max(Auth.LENGTH);

    /** 국내 전화번호 형식. (e.g. 01012345678) */
    export const phoneNumber = z.string()
        .min(10)
        .max(11);

    /** E.164 형식의 국제 전화번호. (e.g. +821012345678) */
    export const phoneNumberAsE164 = z.string()
        .min(12)
        .max(15);

    /** 표준적으로 유효한 이메일 형식. */
    export const email = z.string()
        .max(APILength.email)
        .refine(Test.isEmail);

    /** 액세스 토큰 등에서 사용되는 토큰 형식. */
    export const token = z.string()
        .min(APILength.token)
        .max(APILength.token);

    /** 정의될 수 있는 최소한의 URL 형식. */
    export const url = z.string().max(APILength.url);

    /** API 서버에서 표준적으로 주소를 정의하는 형식. */
    export const address = z.object({
        zipCode: z.number(),
        details: z.string().optional(),
        street: z.string(),
        note: z.string().optional()
    });

    /** API 서버에서 표준적으로 단순 날짜를 정의하는 형식. */
    export const date = z.string()
        .min(10)
        .max(10)
        .refine(Test.isDate);

    /** API 서버에서 표준적으로 단순 시간을 정의하는 형식. */
    export const time = z.string()
        .min(8)
        .max(8)
        .refine(Test.isTime);

    /** API 서버에서 표준적으로 날짜와 시간을 정의하는 형식. (ISO 8601) */
    export const dateTime = z.string().min(19).max(29);

    export namespace Profile {
        /** 사용자 표시 이름. */
        export const displayName = z.string()
            .min(2)
            .max(15)
    }

    export namespace Search {
        export const cursor = z.coerce.number().int().optional();
        export const sort = z.enum(["oldest", "newest"]).default("newest");
    }
}