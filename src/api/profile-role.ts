import { APIError, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import z from "zod";
import { DB_CLIENT, REDIS_CLIENT } from "..";
import { API } from "core/src";
import { IssueRoleSerialRequest } from "./issue-role_serial";

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
        const db = await DB_CLIENT.getConnection();
        await db.query("START TRANSACTION");
        await db.query("UPDATE User SET role = ? WHERE id = ?", [info.role, userId]);
        await db.query("INSERT IGNORE INTO UserDetails(`userId`) VALUES(?)", [userId]);
        await db.query("COMMIT");
        await db.end();

        // 사용된 시리얼 키를 만료시킵니다.
        await REDIS_CLIENT.hDel("RoleSerial", given.serialKey);

        API.success(response, {role: info.role});
    })
});