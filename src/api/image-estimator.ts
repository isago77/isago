import { API, HTTPHandler } from "core";
import { Auth } from "./components/auth";
import { Assets } from "./components/assets";
import { User, UserError, UserRole } from "./components/user";

// image/estimator
export const IMAGE_ESTIMATOR_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body, userId) => {
        const role = await User.roleOf(userId);
    
        // 사용자가 견적 방문자 또는 관리자가 아닌 경우.
        if (role != UserRole.estimator
         && role != UserRole.admin) {
            throw UserError.ONLY_ESTIMATOR;
        }

        const url = await Assets.uploadIamge(body);

        API.success(response, {url: url});
    })
});