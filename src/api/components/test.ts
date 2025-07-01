
export namespace Test {
    /** 주어진 문자열이 이메일 형식인지에 대한 간단한 여부를 반환합니다. */
    export function isEmail(text: string) {
        return /\w+@\w+\.\w+/g.test(text);
    }
}