
export class SQLModifier {
    #params: {[key: string]: any} = {};

    get size(): number {
        return Object.keys(this.#params).length;
    }

    get isEmpty(): boolean {
        return this.size == 0;
    }

    /** SQL의 SET 절 형태로 key들을 반환합니다 (e.g. `name` = ?, `age` = ?) */
    get setter() {
        return Object.keys(this.#params)
            .map((key) => `\`${key}\` = ?`)
            .join(", ");
    }

    /** 등록된 key에 대응하는 value 배열을 반환합니다. */
    get values(): any[] {
        return Object.entries(this.#params).map((value) => value[1]);
    }

    /**
     * 수정할 항목을 추가합니다 (e.g. key와 value 한 쌍)
     * 이후 setter와 values에서 이 정보가 사용됩니다.
     */
    add(key: string, value: any) {
        this.#params[key] = value;
    }

    /**
     * 주어진 객체의 키가 존재할 경우라도 값이 null이 아닐 때만
     * 해당 값을 수정 대상에 포함시킵니다.
     */
    addIfNotNull(obj: {[key: string]: any}, key: string) {
        if (obj[key] != null) {
            this.add(key, obj[key]);
        }
    }

    /**
     * 주어진 객체의 키가 존재할 경우, 값의 null 여부와는 상관없이
     * 해당 값을 수정 대상에 포함시킵니다.
     */
    addIfDefined(obj: {[key: string]: any}, key: string) {
        if (key in obj) {
            this.add(key, obj[key]);
        }
    }

    /** 수정자가 단 하나도 없을 때는 SQL 작업을 수행하지 않도록 합니다. */
    async safety(callback: Function) {
        if (!this.isEmpty) await callback();
    }
}