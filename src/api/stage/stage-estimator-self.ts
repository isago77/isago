import { HTTPHandler } from "core";
import { Auth } from "../components/auth";

// stage/estimator/self
export const STAGE_ESTIMATOR_SELF_HANDLER = new HTTPHandler({
    get: Auth.delegate(async (_, response, body, userId) => {
        
    })
})