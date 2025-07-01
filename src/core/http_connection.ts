import * as http from "http";

export class HTTPConnection {
    constructor(
        /** 요청 경로를 '/' 기준으로 분할한 배열 */
        public paths: string[],

        /** Node.js의 HTTP 요청 객체 */
        public request: http.IncomingMessage,

        /** Node.js의 HTTP 응답 객체 */
        public response: http.ServerResponse
    ) {}

    /** 소비되기 직전, 남은 경로 중 첫 번째 경로를 반환합니다. */
    get fristPath() {
        return this.paths[0];
    }

    /** 현재 경로에서 첫 번째 경로를 제거하고 제거된 해당 경로를 그대로 반환합니다. */
    consume(): HTTPConnection {
        this.paths = this.paths.length == 1 ? [] : this.paths.slice(1, this.paths.length);
        return this;
    }
}