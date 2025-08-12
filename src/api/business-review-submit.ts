import z from "zod";
import axios from "axios";
import { API, APIError, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { APISchema } from "./components/api_schema";
import { config } from "dotenv";
import { DB_CLIENT } from "..";

config();

/** 국세청의 사업자등록정보 진위확인 및 상태조회 서비스에 대한 서비스 키. */
const API_KEY = process.env.NTS_BUSINESS_API_KEY!;

const BusinessReviewSubmitRequest = z.object({
    numbers: z.string().min(10).max(10), // 사업자등록번호
    imageUrls: z.array(APISchema.url),
    desiredRole: z.enum(["estimator", "mover"]),
});

class BusinessReviewSubmitError {
    /** 국세청 조회 결과에 따라 존재하지 않은 사업자 번호일 때. */
    static INVALID_NUMBERS = new APIError("INVALID_NUMBERS", 400);

    /** 이미 검토 대기 중인 제출이 존재할 때. */
    static ALREADY_EXISTS_PENDING = new APIError("ALREADY_EXISTS_PENDING", 400);
}

interface BusinessResult {
    businessEndedAt: string | null;     // 사업자 등록 종료일
    businessStatus: string;             // 사업자 상태명 (e.g. 계속사업자)
    businessStatusCode: string;         // 사업자 상태 코드 (e.g. 01)
    taxType: string;                    // 과세 유형명 (e.g. 부가가치세 일반과세자)
    taxTypeCode: string;                // 과세 유형 코드
    taxTypeChangedAt: string | null;    // 과세 유형이 변경된 날짜
    isSummaryTaxPayer: boolean;         // 간이과세자 여부 (TRUE: 간이과세자, FALSE: 일반과세자)
    prevTaxType: string;                // 수정 되기 전, 과거 과세 유형명
    prevTaxTypeCode: string;            // 수정 되기 전, 과거 과세 유형 코드
}

async function validate(numbers: string): Promise<BusinessResult | null> {
    const baseUrl = "https://api.odcloud.kr/api/nts-businessman/v1";
    const serviceKey = encodeURIComponent(API_KEY);

    const result = await axios.post(
        `${baseUrl}/status?serviceKey=${serviceKey}&returnType=JSON`,
        {"b_no": [numbers]}
    );

    // YYYYMMDD -> YYYY-MM-DD 으로 포맷팅.
    const formatDate = (at?: string) => {
        if (!at) return null;
        return `${at.slice(0,4)}-${at.slice(4,6)}-${at.slice(6,8)}`;
    }

    // 주어진 사업자 정보가 존재하지 않는 경우.
    if (!result.data.match_cnt) return null;

    const data = result.data.data[0];

    return {
        businessEndedAt: formatDate(data["end_dt"]),
        businessStatus: data["b_stt"],
        businessStatusCode: data["b_stt_cd"],
        taxType: data["tax_type"],
        taxTypeCode: data["tax_type_cd"],
        taxTypeChangedAt: formatDate(data["tax_type_change_dt"]),
        isSummaryTaxPayer: data["utcc_yn"] == "Y",
        prevTaxType: data["rbf_tax_type"],
        prevTaxTypeCode: data["rbf_tax_type_cd"],
    }
}

// business/review/submit
export const BUSINESS_REVIEW_SUBMIT_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(BusinessReviewSubmitRequest, body);

        const [pendingReview] = await DB_CLIENT.query(
            "SELECT COUNT(*) AS count FROM BusinessReview WHERE userId = ? AND status = ?",
            [userId, "pending"],
        );

        // 이미 검토 대기 중인 제출이 존재하는 경우.
        if (pendingReview.count > 0) {
            throw BusinessReviewSubmitError.ALREADY_EXISTS_PENDING;
        }

        const result = await validate(given.numbers);

        // 국세청 조회 결과에 따라 주어진 사업자 등록 번호가 존재하지 않는 경우.
        if (!result) {
            throw BusinessReviewSubmitError.INVALID_NUMBERS;
        }

        const uuid = API.createUUID();
        const fields = [
            "id",
            "userId",
            "desiredRole",
            "imageUrls",
            "businessNumber",
            "businessEndedAt",
            "businessStatus",
            "businessStatusCode",
            "taxType",
            "taxTypeCode",
            "taxTypeChangedAt",
            "isSummaryTaxPayer",
            "prevTaxType",
            "prevTaxTypeCode",
        ];

        // e.g. "?, ?, ?"
        const placeholders = fields.map(_ => "?").join(", ");

        await DB_CLIENT.query(`INSERT INTO BusinessReview(${fields.join(", ")}) VALUES(${placeholders})`,[
            uuid,
            userId,
            given.desiredRole,
            JSON.stringify(given.imageUrls),
            given.numbers,
            result.businessEndedAt,
            result.businessStatus,
            result.businessStatusCode,
            result.taxType,
            result.taxTypeCode,
            result.taxTypeChangedAt,
            result.isSummaryTaxPayer,
            result.prevTaxType,
            result.prevTaxTypeCode,
        ]);

        API.success(response, {uuid});
    }),
});