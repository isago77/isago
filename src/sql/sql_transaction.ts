import { PoolConnection } from "mariadb/*";
import { DB_CLIENT } from "..";

export class SQLTransaction {
    static async perform(func: (db: PoolConnection) => Promise<void>) {
        const db = await DB_CLIENT.getConnection();
        try {
            await db.query("START TRANSACTION");
            await func(db);
            await db.query("COMMIT");
        } catch (error) {
            db.query("ROLLBACK");
            throw error;
        } finally {
            db.release();
        }
    }
}