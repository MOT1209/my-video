import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ShortProps } from "../../../types/shorts";

/**
 * مخطط المرحلة 4 (SaaS) — Postgres عبر Neon + Drizzle.
 * كل الجداول تُخزَّن في نفس قاعدة Postgres، ولا يعتمد أي منها على
 * مصادقة أو مفاتيح Stripe (يمكن تشغيل المخطط بلا تلك الطبقات).
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** معرّف Clerk — يُخزَّن نصاً حتى لا يعتمد المخطط على مزوّد المصادقة. */
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email"),
  plan: text("plan").notNull().default("free"),
  /** رصيد التصيير المتبقي (تصيير واحد = كريدت واحد). */
  credits: integer("credits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** حالة المحرّر الكاملة (تلتحم مع ShortProps) — تُخزَّن كـ JSONB. */
    props: jsonb("props").$type<ShortProps>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("projects_user_updated_idx").on(t.userId, t.updatedAt)],
);

/** حالات التصيير: مُنتظِر (طابور/إعادة محاولة)، جارٍ، مكتمل، فاشل. */
export const RENDER_STATUSES = ["queued", "running", "done", "error"] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number];

export const renders = pgTable(
  "renders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    compositionId: text("composition_id").notNull(),
    /** مدخلات التصيير — لازمة لإعادة المحاولة من الطابور بلا تدخل العميل. */
    inputProps: jsonb("input_props").$type<Record<string, unknown>>(),
    status: text("status").$type<RenderStatus>().notNull().default("running"),
    url: text("url"),
    /** مسار كاش Blob الحتمي — يعيد نفس الفيديو بلا تصيير. */
    cacheKey: text("cache_key"),
    sizeBytes: integer("size_bytes"),
    durationSec: integer("duration_sec"),
    sandboxMs: integer("sandbox_ms"),
    creditsUsed: integer("credits_used").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    /**
     * لحظة إرجاع كريدت الصف — وجودها = أُرجع. يُضبط في نفس جملة SQL التي
     * تزيد الرصيد، فلا يُرجَع الكريدت مرتين ولو تكرّر النداء من عمليات مختلفة.
     */
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("renders_user_created_idx").on(t.userId, t.createdAt),
    /**
     * تصيير نشط واحد لكل (مستخدم، ناتج): طلبان متزامنان لنفس الفيديو لا
     * يُخصمان مرتين حتى لو سقط القفل الموزّع (القاعدة هي الضامن الأخير).
     */
    uniqueIndex("renders_active_user_cache_uq")
      .on(t.userId, t.cacheKey)
      .where(sql`${t.status} in ('queued', 'running') and ${t.cacheKey} is not null`),
  ],
);

export const USAGE_KINDS = [
  "render",
  "tts",
  "image",
  "script",
  "transcribe",
  "purchase",
] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

/** سجل استهلاك مسطّح — أساس لوحة الاستهلاك وإحصاء $/video لكل مستخدم. */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<UsageKind>().notNull(),
    units: integer("units").notNull().default(1),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("usage_user_at_idx").on(t.userId, t.at)],
);

/**
 * أحداث Stripe المُعالجة — وجود الصف = مُعالَج.
 * يمنع تلقائي الكريدت مرتين عند إعادة إرسال نفس الويب هوك (Stripe تعيد
 * الإرسال عند أي رد غير 2xx)، ويُحذف الصف إذا فشل التطبيق ليُعاد لاحقاً.
 */
export const stripeEvents = pgTable("stripe_events", {
  /** معرّف الحدث من Stripe (evt_...) — مفتاح أساسي = أساس منع التكرار. */
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  credits: integer("credits").notNull().default(0),
  /**
   * جلسة الدفع التي مُنح بسببها الكريدت — فريد: حدثان مختلفان لنفس الجلسة
   * (`completed` ثم `async_payment_succeeded`) لا يمنحان الحزمة مرتين.
   */
  checkoutSessionId: text("checkout_session_id").unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
