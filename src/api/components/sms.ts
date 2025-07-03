import { assert } from "console";
import { config } from "dotenv";
import { SolapiMessageService } from "solapi";

config();

const service = new SolapiMessageService(
    process.env.COOLSMS_API_KEY!,
    process.env.COOLSMS_SECRET_KEY!
);

export class SMS {
    /** 발신자의 전화번호. */
    static PHONE_NUMBER: string = process.env.COOLSMS_PHONE_NUMBER!;

    static async send(
        to: string,
        message: string
    ) {
        assert(message.length <= 45);

        await service.send({
            to: to,
            from: SMS.PHONE_NUMBER,
            text: message,
        });
    }
}