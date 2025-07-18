import assert from "assert";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "dotenv";

config();

const DECRYPTION_KEY = process.env.DECRYPTION_KEY;
assert(DECRYPTION_KEY != null, "필수 환경 변수 값인 'DECRYPTION_KEY'이(가) 정의되지 않았습니다.");
assert(DECRYPTION_KEY.length == 64, "환경 변수 'DECRYPTION_KEY'에 대한 길이는 총 64 글자여야만 합니다.");
assert(/^[0-9a-fA-F]{64}$/.test(DECRYPTION_KEY), "환경 변수 'DECRYPTION_KEY'는 16진수 문자열이어야 합니다.");

// 특정 데이터가 복호화 가능한 암호화가 되었을 때의 기본 형태입니다.
interface Encrypted {
    iv: string;
    tag: string;
    content: string;
}

export class Secure {
    /** 주어진 텍스트를 AES-256-GCM 방식으로 암호화하여 이를 반환합니다. */
    static encrypt(text: string): Encrypted {
        const key = Buffer.from(DECRYPTION_KEY!, 'hex');
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", key, iv);

        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();

        return {
            iv: iv.toString('hex'),
            tag: authTag.toString('hex'),
            content: encrypted.toString('hex'),
        };
    }

    /** 주어진 암호화되었던 데이터를 AES-256-GCM 방식으로 복호화하여 이를 반환합니다. */
    static decrypt(encrypted: Encrypted): string {
        const key = Buffer.from(process.env.DECRYPTION_KEY!, 'hex');
        const iv = Buffer.from(encrypted.iv, 'hex');
        const tag = Buffer.from(encrypted.tag, 'hex');
        const encryptedText = Buffer.from(encrypted.content, 'hex');

        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([
            decipher.update(encryptedText),
            decipher.final(),
        ]);

        return decrypted.toString("utf8");
    }
}