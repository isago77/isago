import axios from "axios";
import { config } from "dotenv";

config();

/** 토스페이먼츠 API에 대한 시크릿 키. */
const SECRET_KEY = process.env.TOSS_SECRET_KEY;

/** 토스페이먼츠 API 전송용 인증 키에 대한 헤더 값입니다. */
const encryptedSecretKey = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;

export class Payment {
    /** 주어진 데이터를 기반으로 토스페이먼츠 측 결제를 시도합니다. */
    static async confirm(data: {
        paymentKey: string;
        orderId: string;
        amount: number;
    }) {
        return await axios.post(
            "https://api.tosspayments.com/v1/payments/confirm", data, {
            headers: {
                Authorization: encryptedSecretKey,
                "Content-Type": "application/json"
            }
        });
    }

    /** 주어진 데이터를 기반으로 토스페이먼츠 측 결제 취소(환불)를 시도합니다. */
    static async cancel(data: {
        paymentKey: string;
        cancelReason: string;
    }) {
        return await axios.post(
            `https://api.tosspayments.com/v1/payments/${data.paymentKey}/cancel`,
            {cancelReason: data.cancelReason},
            {headers: {
                Authorization: encryptedSecretKey,
                "Content-Type": "application/json"
            }}
        );
    }
}