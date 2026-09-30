import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function getPool(): Pool {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const existing = globalForDb.__arenaNextJsPostgresqlPool;
  if (existing) return existing;

  const created = new Pool({
    connectionString: databaseUrl,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = created;
  }

  return created;
}

/**
 * Keep database initialization lazy.
 *
 * Next.js evaluates API route modules during the production build. The
 * database is only needed when an API route is actually called, so a
 * missing DATABASE_URL must not make the entire application fail to build.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property, receiver) {
    const database = drizzle(getPool());
    return Reflect.get(database as object, property, receiver);
  },
});
