import { defineConfig } from "drizzle-kit";

/**
 * إعداد Drizzle Kit — يولّد SQL الترحيلات من `src/lib/db/schema.ts`.
 * - `npm run db:generate` → يكتب ملفات SQL في `drizzle/` (تُطبَّق في الاختبارات
 *   على PGlite، وتُطبَّق على Neon بـ `npm run db:migrate`).
 * - `npm run db:push` → يدفع المخطط مباشرة لقاعدة التطوير.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
