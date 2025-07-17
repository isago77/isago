import { DB_CLIENT, REDIS_CLIENT, server } from "../src";

// 테스트 실행 전에 서버가 연결될 때까지 대기.
beforeAll(done => { server.once("listening", done) });

// 모든 테스트 종료 후 서버를 종료.
afterAll(async () => {
    await DB_CLIENT.end();
    await REDIS_CLIENT.quit();
    await new Promise<Error | undefined>(resolve => server.close(resolve));
});