
/** API 핸들러에서 고의적으로 예외를 발생시킬 때 사용됩니다. */
export class APIError {
    message: string;
    code: number;

    constructor(message: string, code: number) {
        this.message = message;
        this.code = code;
    }

    static INVALID_REQUEST_FORMAT = new APIError("INVALID_REQUEST_FORMAT", 400);
    static INVALID_UUID = new APIError("INVALID_UUID", 400);
}