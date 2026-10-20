import { readdirSync, readFileSync } from "node:fs";
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
const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "..", "drizzle");
/** كل ملفات الترحيل بالترتيب — ترحيل جديد يُختبر تلقائياً بلا تعديل هنا. */
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

export interface TestDb {
  db: Db;
  client: PGlite;
  /** استعلام SQL خام — لفحص ما لا تكشفه طبقة المستودع. */
  query: <TRow extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[] }>;
}

/** يطبّق ملف ترحيل واحداً بنفس تقسيم drizzle-kit (لاختبار الترقية خطوة خطوة). */
export async function applyMigrationFile(client: PGlite, file: string): Promise<void> {
  const path = join(MIGRATIONS_DIR, file);
  for (const statement of readFileSync(path, "utf8").split(BREAKPOINT)) {
    const trimmed = statement.trim();
    if (trimmed) {
      await client.exec(trimmed);
    }
  }
}

export const ALL_MIGRATION_FILES: readonly string[] = MIGRATION_FILES;

export async function createTestDb(
  options: { migrations?: readonly string[] } = {},
): Promise<TestDb> {
  const client = new PGlite();
  for (const file of options.migrations ?? MIGRATION_FILES) {
    await applyMigrationFile(client, file);
  }
  const db = drizzle(client, { schema }) as unknown as Db;
  return {
    db,
    client,
    query: async (sql, params) =>
      (await client.query(sql, params)) as unknown as { rows: never[] },
  };
}
