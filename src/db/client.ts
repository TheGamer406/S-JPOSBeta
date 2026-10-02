import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const DB_PATH = process.env.SJ_POS_DB_PATH ?? 'sj-pos.db';

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL'); // resiste apagones de golpe (§6, §8)
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };
