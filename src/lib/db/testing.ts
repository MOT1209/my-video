import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { Db } from "./client";
import * as schema from "./schema";

/**
 * قاعدة اختبار حقيقية: PGlite (Postgres في WASM) تُطبَّق عليها **نفس**
 * ملفات الترحيل المُولَّدة لـ Neon — فيُختبر المخطط والاستعلامات الفعلية
 * بلا شبكة ولا مفاتيح. ليست ملف اختبار بذاته (تُستورد من الاختبارات).
 */

const BREAKPOINT = "--> statement-breakpoint";
const MIGRATION_FILES = ["0000_init.sql"];

export interface TestDb {
  db: Db;
  client: PGlite;
  /** استعلام SQL خام — لفحص ما لا تكشفه طبقة المستودع. */
  query: <TRow extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[] }>;
}

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  for (const file of MIGRATION_FILES) {
    const path = join(import.meta.dir, "..", "..", "..", "drizzle", file);
    for (const statement of readFileSync(path, "utf8").split(BREAKPOINT)) {
      const trimmed = statement.trim();
      if (trimmed) {
        await client.exec(trimmed);
      }
    }
  }
  const db = drizzle(client, { schema }) as unknown as Db;
  return {
    db,
    client,
    query: async (sql, params) =>
      (await client.query(sql, params)) as unknown as { rows: never[] },
  };
}
