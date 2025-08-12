import { APIError, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import z from "zod";
import { DB_CLIENT, REDIS_CLIENT } from "..";
import { API } from "core/src";
import { IssueRoleSerialRequest } from "./issue-role_serial";
import { User, UserError, UserRole } from "./components/user";
import { SQLTransaction } from "../sql/sql_transaction";

/** 서버 측에서 정의한 역할에 대한 시리얼 키 정보에 대한 데이터 형태. */
const RoleSerial = IssueRoleSerialRequest;

const ProfileRoleRequest = z.object({
    serialKey: z.string()
});

// profile/role
export const PROFILE_ROLE_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(ProfileRoleRequest, body);
        const rawInfo = await REDIS_CLIENT.hGet("RoleSerial", given.serialKey);

        // 유효하지 않은 시리얼 키인 경우.
        if (!rawInfo) throw APIError.INVALID_SERIAL_KEY;

        const info = API.tryParseJSON(RoleSerial, rawInfo);
        
        // 조회된 시리얼 키 정보에 따라 사용자의 역할을 업데이트합니다.
        await SQLTransaction.perform(async (db) => {
            await User.assignRole(userId, info.role as UserRole, db);
        });

        // 사용된 시리얼 키를 만료시킵니다.
        await REDIS_CLIENT.hDel("RoleSerial", given.serialKey);

        API.success(response, {role: info.role});
    }),
    delete: Auth.delegate(async (_1, response, _2, userId) => {
        const result = await DB_CLIENT.query(
            "UPDATE User SET role = ? WHERE id = ? AND role IS NOT NULL",
            [null, userId]
        );

        // 조회된 결과를 기반으로 이미 역할이 존재하지 않은 경우.
        if (result.affectedRows == 0) {
            throw UserError.REQUIRES_ROLE;
        }

        API.success(response, undefined);
    })
});