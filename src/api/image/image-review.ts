import { API, HTTPHandler } from "core";
import { Auth } from "../components/auth";
import { Assets } from "../components/assets";

// image/review
export const IMAGE_REVIEW_HANDLER = new HTTPHandler({
    post: Auth.delegate(async (_, response, body) => {
        const url = await Assets.uploadIamge(body, {
            maxWidth: 1920,
            maxHeight: 1920
        });

        API.success(response, {url: url});
    })
});