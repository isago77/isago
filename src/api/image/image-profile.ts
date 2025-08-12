import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { Assets } from "../components/assets";

// image/profile
export const IMAGE_PROFILE_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body) => {
        const url = await Assets.uploadIamge(body, {
            maxWidth: 512,
            maxHeight: 512
        });

        API.success(response, {url: url});
    })
});