import { DB_CLIENT } from "..";
import { API, HTTPHandler } from "core";
import { Auth } from "./components/auth";

// settlements/stats
export const SETTLEMENTS_STATS_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (_1, response, _2, userId) => {
        const [distributions, [intervalMonth]] = await Promise.all([
            // 정산금 상태별 총 금액을 조회합니다.
            DB_CLIENT.query(
                `
                    SELECT status, IFNULL(SUM(amount), 0) AS totalAmount FROM Settlement
                    WHERE userId = ? GROUP BY status
                `,
                [userId]
            ),

            // 한달간 발생한 총 금액을 조회합니다.
            DB_CLIENT.query(
                `
                    SELECT IFNULL(SUM(amount), 0) AS totalAmount FROM Settlement
                    WHERE userId = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
                `,
                [userId]
            ),
        ]);

        const result = {
            totalAmount: 0,
            monthAmount: intervalMonth.totalAmount,
            unpaidAmount: 0,
            distributions,
        };

        // 평생 동안 발생한 정산금에 대한 총 금액을 계산.
        distributions.forEach((e: any) => result.totalAmount += e.totalAmount);

        // 상태가 'pending' 또는 'failed'인 항목만 필터링하여 아직 지급되지 않은 금액에 대한 합계를 계산.
        result.unpaidAmount = distributions
            .filter((e: any) => e.status == "pending" || e.status == "failed")
            .reduce((a: number, b: any) => a + b.totalAmount, 0);

        API.success(response, result);
    })
});