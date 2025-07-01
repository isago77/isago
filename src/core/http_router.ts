import { HTTPConnection } from "./http_connection";
import { HTTPHandler } from "./http_handler";

/**
 * 해당 클래스는 URL 경로에 따라 요청을 적절한 HTTP 핸들러로 위임하는 계층형 라우터입니다.
 * 
 * - 각 인스턴스는 하나의 경로와 해당 경로를 처리할 핸들러를 가집니다.
 * - 자식 라우터(children)를 통해 트리 구조를 형성하며, 재귀적으로 요청을 위임시킵니다.
 * - 경로가 완전히 소모되거나, 중간에서 핸들러가 없을 경우에는 현재 핸들러가 요청을 처리하게 됩니다.
 */
export class HTTPRouter {
    constructor(
        public path: string,
        public handler?: HTTPHandler,
        public children?: HTTPRouter[]
    ) {}

    handle(connection: HTTPConnection) {
        if (this.handler == null) {
            throw new Error("주어진 경로를 처리하기 위한 HTTP 핸들러가 존재하지 않습니다.");
        }

        this.handler.delegate(connection);
    }

    /** 요청 처리 작업을 사용자 요청 경로에 해당하는 HTTP 핸들러에게 위임합니다. */
    delegate(connection: HTTPConnection) {
        const paths = connection.paths;

        if (paths.length != 0) {
            const target = this.children?.findLast(e => e.path == paths[0]);

            // 주어진 요청 경로에 해당하는 핸들러가 만약 존재하지 않는 경우,
            // 안전하게 라우팅하기 위해서 핸들러 스스로 해당 작업을 처리합니다.
            if (target) {
                target.delegate(connection.consume());
            } else {
                if (this.handler == null) {
                    connection.response.writeHead(404);
                    connection.response.end();
                    return;
                }

                this.handle(connection);
            }
        } else {
            this.handle(connection);
        }
    }

    /** 요청 처리 작업을 자기 자신을 기준으로 HTTP 핸들러에게 위임합니다. */
    perform(connection: HTTPConnection) {
        if (connection.paths.length != 0) {
            this.delegate(connection.consume());
        } else {
            this.handle(connection);
        }
    }
}
