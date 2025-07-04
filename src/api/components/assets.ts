import axios from "axios";
import { config } from "dotenv";
import { URLSearchParams } from "url";

config()

const host = process.env.ASSETS_SERVER_HOST;
const port = process.env.ASSETS_SERVER_PORT;
const apiKey = process.env.ASSETS_SERVER_API_KEY;

if (!host || !apiKey) {
  throw new Error("필수 환경 변수 누락됨: ASSETS_SERVER_HOST");
}

export class Assets {
    /** 환경 변수에서 호스트와 포트를 조합해 기본 URL을 설정합니다. */
    static url = new URL("http://" + (port ? `${host}:${port}` : host!));

    /**
     * 주어진 이미지 버퍼를 위임하여 제약 조건과 함께 에셋 서버에 이를 업로드하고,
     * 업로드가 성공하면 해당 이미지를 참조할 수 있는 URL을 문자열 형태로 반환합니다.
     */
    static async uploadIamge(buffer: Buffer, constarint?: {
        maxWidth?: number;
        maxHeight?: number;
    }) {
        const params = new URLSearchParams();

        // 제약조건이 있으면 JSON 문자열로 변환해 쿼리 파라미터에 추가.
        if (constarint) {
            params.append("constarint", JSON.stringify(constarint));
        }

        const result = await axios.post(`${this.url}image?${params}`, buffer, {
            headers: {Authorization: apiKey}
        });

        // 업로드 결과로 받은 uuid를 이용해 접근 가능한 이미지 URL을 반환.
        return `${this.url}image?uuid=${result.data.uuid}`;
    }
}