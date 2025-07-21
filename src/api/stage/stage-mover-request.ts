import z from "zod";
import { APISchema } from "../components/api_schema";
import { APIError, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { API } from "core/src";
import { DB_CLIENT } from "../..";
import { StageStatus } from "./components/stage_status";
import { User, UserError, UserRole } from "../components/user";
import { SQLSearcher } from "../../sql/sql_searcher";
import { Notification } from "../components/notification";

const StageMoverRequestPostRequest = z.object({
    uuid: APISchema.uuid,
    proposedPrice: z.number(),
    note: z.string().optional(),
});

const StageMoverRequestGetRequest = z.object({
    stageId: APISchema.uuid,
    sort: APISchema.Search.sort,
    cursor: APISchema.Search.cursor,
});

export class StageMoverRequestError {
    /** 그 전 단계이거나 이미 이사 업체가 할당되어 이사 절차가 진행 중일 때. */
    static ONLY_WAITING_MOVER_STATUS = new APIError("ONLY_WAITING_MOVER_STATUS", 403);

    /** 이사 업체가 이미 요청한 이사 절차에 중복 제안을 했을 때. */
    static ALREADY_MOVER_REQUEST = new APIError("ALREADY_MOVER_REQUEST", 400);
}

// stage/mover/request
export const STAGE_MOVER_REQUEST_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageMoverRequestPostRequest, body);
        const role = await User.roleOf(userId);

        // 사용자가 전용 권한을 가진 이사 업체 또는 관리자가 아닌 경우.
        if (role != UserRole.mover
         && role != UserRole.admin) {
            throw UserError.ONLY_MOVER;
        }

        // 유효성 검사.
        const [stage] = await DB_CLIENT.query(
            "SELECT status, userId FROM Stage WHERE id = ? LIMIT 1",
            [given.uuid]
        );

        // 유효하지 않은 UUID인 경우.
        if (!stage) throw APIError.INVALID_UUID;

        // 그 전 단계이거나 이미 이사 업체가 할당되어 본격적인 이사 절차가 진행 중인 경우.
        if (stage.status != StageStatus.waitingMover) {
            throw StageMoverRequestError.ONLY_WAITING_MOVER_STATUS;
        }

        const [row] = await DB_CLIENT.query(
            "SELECT 1 FROM MoverRequest WHERE stageId = ? AND moverId = ?",
            [given.uuid, userId]
        );

        // 이사 업체가 이미 요청한 이사 절차에 중복 제안을 한 경우.
        if (row) throw StageMoverRequestError.ALREADY_MOVER_REQUEST;

        const uuid = API.createUUID();

        await DB_CLIENT.query(
            "INSERT INTO MoverRequest(id, stageId, moverId, proposedPrice, note) VALUES (?, ?, ?, ?, ?)",
            [uuid, given.uuid, userId, given.proposedPrice, given.note]
        );

        // 이사 업체가 견적을 제안한 이사 절차의 사용자에게 해당 사실을 알림.
        User.displayNameOf(userId).then(async displayName => {
            const formater = new Intl.NumberFormat("ko-KR");

            await Notification.sendTo(stage.userId, {
                type: "moverRequest",
                data: JSON.stringify({stageId: given.uuid, requestId: uuid}),
                body: {
                    title: "새로운 이사 제안이 도착했어요!",
                    body: `${displayName}님이 ${formater.format(given.proposedPrice)}원에 이사를 제안했어요. 앱에서 상세 내용을 확인해 보세요.`,
                }
            });
        }).catch(() => null);

        API.success(response, {uuid})
    }),
    get: Auth.delegate(async (request, response, _1, _2) => {
        const given = API.tryParseURL(StageMoverRequestGetRequest, API.urlOf(request));
        const searcher = new SQLSearcher();
        searcher.add(given.stageId, "stageId = ?");

        const result = await searcher.search(
            "MoverRequest",
            given.sort,
            given.cursor,
        );

        API.success(response, result);
    })
});