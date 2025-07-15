import { DB_CLIENT } from "..";

/** 클라이언트 측에서 한 번에 조회할 수 있는 아이템들의 개수. */
export const SEARCH_MAX_COUNT = 15;

export type SearchSort = "newest" | "oldest";

export interface SearchResult {
    hasMore: boolean;
    cursor?: string;
    body: any[]
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

    /** 서버에서 Cursor-Based Pagination 방식으로 검색 결과를 표준 형태로 가공하여 이를 반환합니다. */
    static createResult(
        rows: any[],
        cursorName: string,
        limitCount: number,
    ) {
        const hasMore = rows.length > limitCount;

        // 초과된 항목은 제거하여 더보기 여부를 판단하고 연산 그리고 응답에서는 제외합니다.
        if (hasMore) rows.pop();

        // 다음 페이지 요청 시 사용할 커서를 마지막 항목에서 추출합니다.
        const cursor = rows.at(-1)?.[cursorName] ?? null;

        // 응답 본문은 최대 주어진 [limitCount]개까지 포함되며, 초과 여부에 따라 잘라냅니다.
        let body = hasMore ? rows.slice(0, limitCount) : rows;

        // 항상 아이템에 대한 고유 커서 값은 최적화, 가독성을 고려하여 이를 생략하여 응답하도록 합니다.
        body.forEach(item => item[cursorName] = undefined);

        return {hasMore, cursor, body};
    }

    async search(
        tableName: string,
        sort: SearchSort,
        cursor?: number,
        cursorKey: string = "a.cursor",
        joinClause?: string,
        fieldClause: string = "*",
    ): Promise<SearchResult> {
        const limitCount = SEARCH_MAX_COUNT + 1;
        const direction = sort == "newest" ? "<" : ">";
        const orderBy = sort === "newest"
            ? `${cursorKey} DESC`
            : `${cursorKey} ASC`;

        const rows: any[] = await DB_CLIENT.query(
            `
                SELECT ${fieldClause} FROM ${tableName} a ${joinClause ?? ""}
                ${(this.isEmpty && !cursor) ? "" : "WHERE"}
                ${this.isEmpty ? "" : `(${this.wheres})`}
                ${cursor ? `${this.isEmpty ? "" : "AND"} ${cursorKey} ${direction} ?` : ""}
                ORDER BY ${orderBy}
                LIMIT ${limitCount}
            `,
            [...this.values, ...(cursor ? [cursor] : [])]
        );

        return SQLSearcher.createResult(
            rows,
            cursorKey.split(".")[1],
            SEARCH_MAX_COUNT,
        );
    }
}