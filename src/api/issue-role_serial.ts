import { API, HTTPHandler } from "core";
import z from "zod";
import { Auth } from "./components/auth";
import { User, UserError, UserRole } from "./components/user";
import { REDIS_CLIENT } from "..";

export const IssueRoleSerialRequest = z.object({
    role: z.enum(["estimator", "mover", "admin"])
});

// issue/role-serial
export const ISSUE_ROLE_SERIAL_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const given = API.tryParseJSON(IssueRoleSerialRequest, body);
        const role = await User.roleOf(userId);

        // 사용자가 전용 권한을 가진 관리자가 아닌 경우.
        if (role != UserRole.admin) throw UserError.ONLY_ADMIN;

        const serialKey = Auth.createSerial();

        await REDIS_CLIENT.multi()
            // 회원가입에 대한 추가적인 인증 작업을 위한 인증 번호를 설정합니다.
            .hSet("RoleSerial", serialKey, JSON.stringify(given))
            // 해당 인증 번호에 대한 만료 시간을 설정합니다. (예시: 10분)
            .hExpire("RoleSerial", serialKey, Auth.SERIAL_EXPIER_DURATION)
            .exec();

        API.success(response, {serialKey});
    })
});