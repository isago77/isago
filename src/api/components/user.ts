import { APIError } from "core";
import { DB_CLIENT } from "../..";

export enum UserRole {
    estimator = "estimator",
    mover = "mover",
    admin = "admin"
}

export class UserError {
    /** 사용자가 관리자가 아닌 경우에도 관리자 권한이 필요한 관련 API를 요청하였을 때. */
    static ONLY_ADMIN = new APIError("ONLY_ADMIN", 403);

    /** 사용자가 견적 방문자가 아닌 경우에도 견적 방문자 권한이 필요한 관련 API를 요청하였을 때. */
    static ONLY_ESTIMATOR = new APIError("ONLY_ESTIMATOR", 403);

    /** 사용자가 이사업체가 아닌 경우에도 이사 업체 권한이 필요한 관련 API를 요청하였을 때. */
    static ONLY_MOVER = new APIError("ONLY_MOVER", 403);

    /** 사용자가 관리자, 견적 방문자, 이사업체 등 관계자가 아닌 경우에도 관련 API를 호출하였을 때. */
    static REQUIRES_ROLE = new APIError("REQUIRES_ROLE", 403);
}

export class User {
    static async roleOf(userId: string): Promise<UserRole | null> {
        const [row] = await DB_CLIENT.query(
            "SELECT role FROM User WHERE id = ? LIMIT 1",
            [userId]
        );

        if (!row) throw new Error("사용자의 역할을 조회하는데 실패하였습니다.");
        return row.role;
    }
}