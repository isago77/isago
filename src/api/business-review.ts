import z from "zod";
import { APISchema } from "./components/api_schema";
import { Auth } from "./components/auth";
import { API, APIError, HTTPHandler } from "core";
import { User, UserError, UserRole } from "./components/user";
import { DB_CLIENT } from "..";
import { Notification } from "./components/notification";
import { SQLTransaction } from "../sql/sql_transaction";

const BusinessReviewRequest = z.object({
    uuid: APISchema.uuid,
    action: z.enum(["accept", "reject"]),
    reason: z.string().optional(),
});

class BusinessReviewError {
    /** 이미 해당 제출이 검토되었을 때. */
    static ALREADY_REVIEWED = new APIError("ALREADY_REVIEWED", 400);
}

// business/review
export const BUSINESS_REVIEW_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(BusinessReviewRequest, body);
        const role = await User.roleOf(userId);

        // 사용자가 전용 권한을 가진 관리자가 아닌 경우.
        if (role != UserRole.admin) {
            throw UserError.ONLY_ADMIN;
        }

        const [review] = await DB_CLIENT.query(
            "SELECT userId, status, desiredRole FROM BusinessReview WHERE id = ? LIMIT 1",
            [given.uuid],
        );

        // 유효하지 않은 UUID인 경우.
        if (!review) {
            throw APIError.INVALID_UUID;
        }

        // 이미 해당 제출이 검토되었을 경우.
        if (review.status != "pending") {
            throw BusinessReviewError.ALREADY_REVIEWED;
        }

        await SQLTransaction.perform(async (db) => {
            await db.query(
                "UPDATE BusinessReview SET status = ?, reason = ? WHERE id = ?",
                [given.action == "accept" ? "accepted" : "rejected", given.reason, given.uuid],
            );

            // 검토 결과에 따라 사용자의 역할을 업데이트합니다.
            if (given.action == "accept") {
                await User.assignRole(review.userId, review.desiredRole, db);
            }
        });

        // 해당 제출이 승인 또는 거절되었다고 사용자에게 이를 알림.
        Notification.sendTo(review.userId, {
            type: given.action == "accept"
                ? "businessReviewAccepted"
                : "businessReviewRejected",

            data: JSON.stringify({
                uuid: given.uuid,
                reviewerId: userId,
                reason: given.reason,
            }),

            body: given.action == "accept" ? {
                title: "사업자 인증이 승인되었습니다",
                body: "이제 관련 서비스를 정상적으로 이용하실 수 있습니다."
            } : {
                title: "사업자 인증이 거절되었습니다",
                body: "입력하신 정보가 기준에 맞지 않아 등록이 거절되었습니다. 다시 시도해 주세요."
            }
        });

        API.success(response, undefined);
    })
});