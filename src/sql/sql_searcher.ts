import { DB_CLIENT } from "..";

/** 클라이언트 측에서 한 번에 조회할 수 있는 아이템들의 개수. */
const SEARCH_MAX_COUNT = 15;

export enum SearchSort {
    newest = "newest",
    oldest = "oldest"
}

export class SQLSearcher {
    #params: {value: any, syntax: string}[] = [];

    get isEmpty(): boolean {
        return this.#params.length == 0;
    }

    get values() {
        return this.#params.map(v => v.value);
    }

    get wheres() {
        return this.#params.map(v => v.syntax).join(" AND ");
    }

    add(value: any, syntax: string) {
        value instanceof Object
            ? this.#params.push({value: JSON.stringify(value), syntax})
            : this.#params.push({value, syntax});
    }

    /**
     * 주어진 객체의 키가 존재할 경우, 값의 null 여부와는 상관없이
     * 해당 값을 검색 대상에 포함시킵니다.
     */
    addIfNotNull(obj: {[key: string]: any}, key: string, syntax: string) {
        if (obj[key] != null) {
            this.add(obj[key], syntax);
        }
    }

    /**
     * 주어진 객체의 키가 존재할 경우, 값의 null 여부와는 상관없이
     * 해당 값을 검색 대상에 포함시킵니다.
     */
    addIfDefined(obj: {[key: string]: any}, key: string, syntax: string) {
        if (key in obj) {
            this.add(obj[key], syntax);
        }
    }

    async search(tableName: string, page: number, sort: SearchSort) {
        const offset = page * SEARCH_MAX_COUNT;
        const orderBy = sort == SearchSort.newest
            ? `createdAt DESC`
            : `createdAt ASC`;

        return await DB_CLIENT.query(
            `
                SELECT * FROM ${tableName} ${this.isEmpty ? "" : "WHERE"}
                ${this.wheres}
                ORDER BY ${orderBy}
                LIMIT ${SEARCH_MAX_COUNT}
                OFFSET ${offset}
            `,
            this.values
        );
    }
}