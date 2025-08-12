import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { Assets } from "../components/assets";
import { User, UserError } from "../components/user";

// image/banner
export const IMAGE_BANNER_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_1, response, body, userId) => {
        const role = await User.roleOf(userId);

        // 사용자가 견적 방문자 그리고 이사 업체 또는 관리자가 아닌 경우.
        if (role == null) {
            throw UserError.REQUIRES_ROLE;
        }

        const url = await Assets.uploadIamge(body);

        API.success(response, {url: url});
    })
});