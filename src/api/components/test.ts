
export namespace Test {
    /** 주어진 문자열이 이메일 형식인지에 대한 간단한 여부를 반환합니다. */
    export function isEmail(text: string) {
        return /\w+@\w+\.\w+/g.test(text);
    }

    /** 주어진 문자열이 국내 전화번호 형식인지 간단한 여부를 반환합니다. */
    export function isPhoneNumber(text: string) {
        return /^[0-9]{3}[0-9]{3,4}[0-9]{4}/g.test(text);
    }
}