import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

export const hasDb = !!databaseUrl;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool = hasDb
  ? (globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl!,
    }))
  : (null as unknown as Pool);

if (process.env.NODE_ENV !== "production" && hasDb) {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

// In demo mode (no DATABASE_URL) db is null - callers must check hasDb
export const db: ReturnType<typeof drizzle> | null = hasDb ? drizzle(pool as Pool, { schema }) : null as unknown as ReturnType<typeof drizzle>;
