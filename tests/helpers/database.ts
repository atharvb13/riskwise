import { randomUUID } from "node:crypto";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/** Creates and removes only its own UUID-named database, never the supplied DB. */
export async function createTestDatabase(adminUrl: string) {
  const admin = postgres(adminUrl, {
    max: 1,
    connect_timeout: 5,
    onnotice: () => {},
  });
  const name = `riskwise_test_${randomUUID().replaceAll("-", "")}`;
  let created = false;
  let sql: ReturnType<typeof postgres> | undefined;
  const close = async () => {
    try {
      await sql?.end({ timeout: 5 });
      if (created) {
        // The identifier is generated above, not derived from connection input.
        await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
        created = false;
      }
    } finally {
      await admin.end({ timeout: 5 });
    }
  };
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    created = true;
    const url = new URL(adminUrl);
    url.pathname = `/${name}`;
    sql = postgres(url.toString(), {
      max: 1,
      connect_timeout: 5,
      onnotice: () => {},
    });
    await migrate(drizzle(sql), {
      migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle"),
    });
    return { name, url: url.toString(), sql, close };
  } catch (error) {
    await close();
    throw error;
  }
}
