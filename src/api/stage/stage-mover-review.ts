import z from "zod";
import { API, APIError, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { APISchema } from "../components/api_schema";
import { DB_CLIENT } from "../..";
import { StageMoverStatus } from "./components/stage_mover_status";
import { Notification } from "../components/notification";
import { User } from "../components/user";

const StageMoverReviewPostRequest = z.object({
    stageId: APISchema.uuid,
    rating: z.number().int().min(0).max(5),
    comment: z.string(),
});

const StageMoverReviewGetRequest = z.object({
    stageId: APISchema.uuid,
});

export class StageMoverReviewError {
    /** 그 전 단계이거나 이미 이사 업체가 할당되어 이사 절차가 진행 중일 때. */
    static ONLY_COMPLETED_MOVER_STATUS = new APIError("ONLY_COMPLETED_MOVER_STATUS", 403);

    /** 사용자가 요청한 이사 절차에 대한 중복 리뷰를 시도하려 했을 때. */
    static ALREADY_MOVER_REVIEW = new APIError("ALREADY_MOVER_REVIEW", 400);

    /** 사용자가 요청한 이사 절차에 대해서 리뷰할 권한이 없을 때. */
    static REVIEW_NOT_ALLOWED = new APIError("REVIEW_NOT_ALLOWED", 403);
}

// stage/mover/review
export const STAGE_MOVER_REVIEW_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageMoverReviewPostRequest, body);

        const [stage] = await DB_CLIENT.query(
            "SELECT userId, status FROM Stage WHERE id = ? LIMIT 1",
            [given.stageId]
        );

        // 유효하지 않은 UUID인 경우.
        if (!stage) throw APIError.INVALID_UUID;

        // 사용자가 요청한 이사 절차에 대해서 리뷰할 권한이 없을 경우.
        if (stage.userId != userId) {
            throw StageMoverReviewError.REVIEW_NOT_ALLOWED;
        }

        // 그 전 단계이거나 이미 이사 업체가 할당되어 이사 절차가 진행 중일 경우.
        if (stage.status != StageMoverStatus.completed) {
            throw StageMoverReviewError.ONLY_COMPLETED_MOVER_STATUS;
        }

        // 새로운 리뷰에 대한 UUID.
        const uuid = API.createUUID();

        const result = await DB_CLIENT.query(
            "INSERT IGNORE INTO MoverReview(id, writerId, stageId, rating, comment) VALUES(?, ?, ?, ?, ?)",
            [uuid, userId, given.stageId, given.rating, given.comment]
        );

        // 사용자가 요청한 이사 절차에 대한 중복 리뷰를 시도하려 했을 때.
        if (result.affectedRows == 0) {
            throw StageMoverReviewError.ALREADY_MOVER_REVIEW;
        }

        // 사용자가 이사 업체에 대한 리뷰를 작성했다는 사실을 이사 업체에게 알림.
        (async () => {
            const [moverStage] = await DB_CLIENT.query(
                "SELECT id, moverId FROM MoverStage WHERE stageId = ? LIMIT 1",
                [given.stageId]
            );

            // 해당 이사 절차에 대해서 리뷰를 남긴 사용자 이름.
            const displayName = await User.displayNameOf(stage.userId);

            const data = JSON.stringify({
                uuid: uuid,
                stageId: given.stageId,
                moverStageId: moverStage.id,
            });

            await Notification.sendTo(moverStage.moverId, {
                type: "moverReview",
                data: data,
                body: {
                    title: `${displayName}님이 리뷰를 작성했어요`,
                    body: "리뷰를 꼭 확인하시고 더 나은 서비스 제공에 활용해 주세요!"
                }
            });
        })().catch(() => null);

        API.success(response, {uuid});
    }),
    get: async (request, response, _) => {
        const given = API.tryParseURL(StageMoverReviewGetRequest, API.urlOf(request));

        const fields = [
            "id",
            "writerId",
            "stageId",
            "rating",
            "comment",
            "updatedAt",
            "createdAt"
        ];

        const [row] = await DB_CLIENT.query(
            `SELECT ${fields.join(", ")} FROM MoverReview WHERE stageId = ? LIMIT 1`,
            [given.stageId]
        );

        // 유효하지 않은 UUID인 경우.
        if (!row) throw APIError.INVALID_UUID;

        API.success(response, row);
    }
});