import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import z from "zod";
import { APISchema } from "../components/api_schema";
import { User, UserError, UserRole } from "../components/user";
import { DB_CLIENT } from "../..";
import { APIError } from "core/src";

const StageEstimatorAvailableRequest = z.object({
    date: APISchema.date,
    count: z.number()
});

class StageEstimatorAvailableError {
    static INVALID_REQUEST_DATE = new APIError("INVALID_REQUEST_DATE", 400);
}

// stage/estimator/available
export const STAGE_ESTIMATOR_AVAILABLE_HANDLER = new HTTPHandler({
    put: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(StageEstimatorAvailableRequest, body);
        const role = await User.roleOf(userId);

        // 사용자가 견적 방문자 또는 관리자가 아닌 경우.
        if (role != UserRole.estimator
         && role != UserRole.admin) {
            throw UserError.ONLY_ESTIMATOR;
        }

        const input = new Date(given.date);
        const today = new Date();
        input.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        // 주어진 날짜가 현재 날짜이거나 그 이전인 경우.
        if (input <= today) {
            throw StageEstimatorAvailableError.INVALID_REQUEST_DATE;
        }

        const [row] = await DB_CLIENT.query(
            "SELECT id FROM EstimatorAvailability WHERE estimatorId = ? AND date = ?",
            [userId, given.date]
        );

        const uuid = row?.id ?? API.createUUID();

        // 이미 별도의 테이블이 생성되어 존재하는 경우.
        if (row) {
            await DB_CLIENT.query(
                "UPDATE EstimatorAvailability SET count = ? WHERE id = ?",
                [given.count, row.id]
            );
        } else {
            await DB_CLIENT.query(
                "INSERT INTO EstimatorAvailability(id, estimatorId, date, count) VALUES(?, ?, ?, ?)",
                [uuid, userId, given.date, given.count]
            );
        }

        API.success(response, {uuid});
    })
});