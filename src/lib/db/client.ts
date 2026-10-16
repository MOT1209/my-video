import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * نوع مشترك لقاعدة البيانات: يصلح لعميل Neon (الإنتاج) وعميل PGlite
 * (الاختبارات) — كلاهما يمتد `PgDatabase` بنفس مخطط الجداول، فتكتب
 * طبقة المستودع مرة واحدة وتُختبر على Postgres حقيقي داخل الاختبار.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | null | undefined;

/** هل DATABASE_URL مهيأ؟ (بدونه تعمل ميزات SaaS معطّلة لا معطوبة). */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * عميل Neon مُهيكل مرة واحدة (HTTP driver — لا اتصالات دائمة مع serverless).
 * يُعيد null إن لم يكن DATABASE_URL مهيأ.
 */
export function getDb(): Db | null {
  if (cached === undefined) {
    const url = process.env.DATABASE_URL;
    cached = url
      ? (drizzle(neon(url), { schema }) as unknown as Db)
      : null;
  }
  return cached;
}

/** للاختبار فقط — يُفرش الكاش كي يُعاد البناء بعد تغيير DATABASE_URL. */
export function resetDbForTests(): void {
  cached = undefined;
}

export { schema };
