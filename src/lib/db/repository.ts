import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { ShortProps } from "../../../types/shorts";
import { FREE_SIGNUP_CREDITS } from "../credits";
import type { Db } from "./client";
import {
  projects,
  renders,
  stripeEvents,
  usageEvents,
  users,
  type RenderStatus,
  type UsageKind,
} from "./schema";

/**
 * مستودع البيانات — كل الوصول لـ Postgres يمرّ من هنا.
 * يأخذ كل شيء `db` صراحةً (بدل استدعاء `getDb()` داخلياً) كي تُختبر
 * نفس الشيفرة على Postgres حقيقي داخل الاختبارات (PGlite) بلا مفاتيح.
 */

/** رسالة موحّدة لغياب المشروع أو محاولة لمس مشروع مستخدم آخر. */
export const PROJECT_NOT_FOUND = "المشروع غير موجود.";

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type RenderRow = typeof renders.$inferSelect;

/** أعلى عدد محاولات تصيير للصف الواحد قبل اعتباره فاشلاً نهائياً. */
export const MAX_RENDER_ATTEMPTS = 3;

/**
 * مدة يُعدّ بعدها صف `queued`/`running` مهجوراً: العملية التي حجزته ماتت
 * (انتهت مهلة دالة الـ cron مثلاً) ولن تُغلق الصف بنفسها. 15 دقيقة آمنة
 * بشكل واسع: التصيير الفعلي (فيديو ≤ 60 ثانية) يُنهى في دقائق قليلة.
 */
export const STALE_RENDER_MS = 15 * 60 * 1000;

/**
 * يضمن وجود صف المستخدم ويُعيده. المستخدم الجديد يحصل على كريدتات
 * الترحيب مرة واحدة فقط (التحديث لا يلمس الرصيد إطلاقاً).
 */
export async function ensureUser(
  db: Db,
  args: { clerkId: string; email?: string | null },
): Promise<UserRow> {
  const rows = await db
    .insert(users)
    .values({
      clerkId: args.clerkId,
      email: args.email ?? null,
      credits: FREE_SIGNUP_CREDITS,
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { updatedAt: new Date() },
    })
    .returning();
  return rows[0];
}

export async function getUserByClerkId(
  db: Db,
  clerkId: string,
): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return rows[0] ?? null;
}

export async function getCredits(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.credits ?? 0;
}

/** زيادة الرصيد (شراء، أو إرجاع كريدت تصيير فشل). */
export async function addCredits(
  db: Db,
  userId: string,
  amount: number,
): Promise<number> {
  const rows = await db
    .update(users)
    .set({
      credits: sql`${users.credits} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ credits: users.credits });
  if (!rows[0]) {
    throw new Error(`مستخدم غير موجود: ${userId}`);
  }
  return rows[0].credits;
}

/**
 * خصم الكريدت **بجملة واحدة مشروطة** — لا قراءة ثم كتابة (سباق صفّين
 * متوازيين كان يمكن أن يجعل الرصيد سالباً). الصفر من الصفوف المُرجعة
 * يعني رصيداً غير كافٍ.
 */
export async function spendCredits(
  db: Db,
  userId: string,
  cost: number,
): Promise<{ ok: boolean; credits: number }> {
  const rows = await db
    .update(users)
    .set({
      credits: sql`${users.credits} - ${cost}`,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), gte(users.credits, cost)))
    .returning({ credits: users.credits });
  if (rows[0]) {
    return { ok: true, credits: rows[0].credits };
  }
  return { ok: false, credits: await getCredits(db, userId) };
}

export async function getProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<ProjectRow | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listProjects(db: Db, userId: string): Promise<ProjectRow[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
    .limit(50);
}

/** حفظ مشروع: تحديث إن مُرّر id مملوك للمستخدم، وإلا إدراج جديد. */
export async function saveProject(
  db: Db,
  args: { userId: string; id?: string | null; title: string; props: ShortProps },
): Promise<ProjectRow> {
  if (args.id) {
    const rows = await db
      .update(projects)
      .set({ title: args.title, props: args.props, updatedAt: new Date() })
      .where(and(eq(projects.id, args.id), eq(projects.userId, args.userId)))
      .returning();
    if (rows[0]) {
      return rows[0];
    }
    // معرّف لا يخصّ المستخدم (أو مُحذوف) → لا نكتب فوق بيانات غيره
    throw new Error(PROJECT_NOT_FOUND);
  }

  const rows = await db
    .insert(projects)
    .values({ userId: args.userId, title: args.title, props: args.props })
    .returning();
  return rows[0];
}

export async function deleteProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const rows = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  return rows.length > 0;
}

export async function createRender(
  db: Db,
  args: {
    userId: string;
    projectId?: string | null;
    compositionId: string;
    inputProps?: Record<string, unknown> | null;
    cacheKey?: string | null;
    status?: RenderStatus;
    creditsUsed?: number;
  },
): Promise<RenderRow> {
  const rows = await db
    .insert(renders)
    .values({
      userId: args.userId,
      projectId: args.projectId ?? null,
      compositionId: args.compositionId,
      inputProps: args.inputProps ?? null,
      cacheKey: args.cacheKey ?? null,
      status: args.status ?? "running",
      creditsUsed: args.creditsUsed ?? 0,
      attempts: 1,
    })
    .returning();
  return rows[0];
}

/** حالات يجوز إغلاقها: صف `done` أو `error` لا يُكتب فوقه أبداً من عامل متأخر. */
const OPEN_RENDER_STATUSES: RenderStatus[] = ["running", "queued"];

/**
 * إغلاق صف تصيير (نجاح أو فشل) **مشروطاً**:
 * - الصف ما زال مفتوحاً (`running`/`queued`) — فعامل متأخر لا يُفسد صفاً
 *   مكتملاً ولا يُعيد فتح صف أُعلن فاشلاً.
 * - `fence.attempts` (اختياري): رقم المحاولة التي حجزها العامل؛ إن حجزت
 *   عملية أحدث الصفّ بعده فكتابته تُتجاهل (fencing token).
 * يُعيد true إن كُتب الإغلاق فعلاً.
 */
export async function finishRender(
  db: Db,
  renderId: string,
  args: {
    status: RenderStatus;
    url?: string | null;
    sizeBytes?: number | null;
    durationSec?: number | null;
    sandboxMs?: number | null;
    error?: string | null;
  },
  fence: { from?: RenderStatus[]; attempts?: number } = {},
): Promise<boolean> {
  const conditions = [
    eq(renders.id, renderId),
    inArray(renders.status, fence.from ?? OPEN_RENDER_STATUSES),
  ];
  if (fence.attempts !== undefined) {
    conditions.push(eq(renders.attempts, fence.attempts));
  }
  const rows = await db
    .update(renders)
    .set({
      status: args.status,
      url: args.url ?? null,
      sizeBytes: args.sizeBytes ?? null,
      durationSec: args.durationSec ?? null,
      sandboxMs: args.sandboxMs ?? null,
      error: args.error ?? null,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({ id: renders.id });
  return rows.length > 0;
}

/** رمز Postgres لانتهاك قيد فريد (يصل مباشرة أو داخل `cause` من Drizzle). */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  for (let cur: unknown = err, depth = 0; cur && depth < 4; depth += 1) {
    const e = cur as { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };
    if (
      e.code === "23505" &&
      (e.constraint === constraint ||
        (typeof e.message === "string" && e.message.includes(constraint)))
    ) {
      return true;
    }
    cur = e.cause;
  }
  return false;
}

export const ACTIVE_RENDER_UNIQUE = "renders_active_user_cache_uq";

export type StartChargedRenderResult =
  | { status: "started"; renderId: string; credits: number }
  | { status: "insufficient"; credits: number }
  | { status: "duplicate" };

/**
 * خصم الكريدت + فتح صف التصيير + تسجيل الاستهلاك في **جملة SQL واحدة**:
 * - لا نافذة بين «خُصم» و«سُجّل» يمكن أن تُقطع (انهيار العملية بينهما كان
 *   يُضيّع كريدتاً بلا أي أثر يسمح بإرجاعه).
 * - الخصم مشروط بالرصيد (لا رصيد سالب)، والصف محكوم بالفهرس الفريد الجزئي
 *   `renders_active_user_cache_uq`: طلب مكرر لنفس الفيديو أثناء تصيير نشط
 *   يُسقط الجملة كلها ⇒ لا خصم مزدوج حتى عبر نسخ خادم مختلفة.
 */
export async function startChargedRender(
  db: Db,
  args: {
    userId: string;
    cost: number;
    compositionId: string;
    inputProps: Record<string, unknown> | null;
    cacheKey: string;
    projectId?: string | null;
  },
): Promise<StartChargedRenderResult> {
  let result: unknown;
  try {
    result = await db.execute(sql`
      WITH charged AS (
        UPDATE ${users}
        SET credits = ${users.credits} - ${args.cost}, updated_at = now()
        WHERE ${users.id} = ${args.userId} AND ${users.credits} >= ${args.cost}
        RETURNING ${users.id} AS user_id, ${users.credits} AS credits
      ),
      created AS (
        INSERT INTO ${renders}
          (user_id, project_id, composition_id, input_props, cache_key, status, credits_used, attempts)
        SELECT user_id, ${args.projectId ?? null}, ${args.compositionId},
               ${args.inputProps === null ? null : JSON.stringify(args.inputProps)}::jsonb,
               ${args.cacheKey}, 'running', ${args.cost}, 1
        FROM charged
        RETURNING id, user_id
      ),
      usage AS (
        INSERT INTO ${usageEvents} (user_id, kind, units, meta)
        SELECT user_id, 'render', ${args.cost}, jsonb_build_object('renderId', id)
        FROM created
      )
      SELECT created.id AS render_id, charged.credits AS credits
      FROM created, charged
    `);
  } catch (err) {
    if (isUniqueViolation(err, ACTIVE_RENDER_UNIQUE)) {
      return { status: "duplicate" };
    }
    throw err;
  }
  const rows = executedRows<{ render_id: string; credits: number }>(result);
  if (rows[0]) {
    return { status: "started", renderId: rows[0].render_id, credits: Number(rows[0].credits) };
  }
  return { status: "insufficient", credits: await getCredits(db, args.userId) };
}

/**
 * إرجاع كريدت صف تصيير **مرة واحدة على الأكثر** وفي جملة واحدة:
 * يُضبط `refunded_at` ويُزاد الرصيد ويُسجَّل استهلاك سالب معاً، ولا يقع
 * شيء إن كان الصف قد أُرجع سابقاً أو اكتمل (`done`) — فلا يُرجَع تصيير
 * ناجح بسبب معالج فشل متأخر، ولا يُدفع الإرجاع مرتين من عمليتين.
 */
export async function refundRender(
  db: Db,
  renderId: string,
): Promise<{ refunded: boolean; credits: number | null }> {
  const result = await db.execute(sql`
    WITH target AS (
      UPDATE ${renders}
      SET refunded_at = now(), updated_at = now()
      WHERE ${renders.id} = ${renderId}
        AND ${renders.refundedAt} IS NULL
        AND ${renders.creditsUsed} > 0
        AND ${renders.status} <> 'done'
      RETURNING id, user_id, credits_used
    ),
    credited AS (
      UPDATE ${users}
      SET credits = ${users.credits} + target.credits_used, updated_at = now()
      FROM target
      WHERE ${users.id} = target.user_id
      RETURNING ${users.credits} AS credits
    ),
    usage AS (
      INSERT INTO ${usageEvents} (user_id, kind, units, meta)
      SELECT user_id, 'render', -credits_used,
             jsonb_build_object('renderId', id, 'refund', true)
      FROM target
    )
    SELECT credits FROM credited
  `);
  const rows = executedRows<{ credits: number }>(result);
  return rows[0]
    ? { refunded: true, credits: Number(rows[0].credits) }
    : { refunded: false, credits: null };
}

export async function listRenders(
  db: Db,
  userId: string,
  limit = 20,
): Promise<RenderRow[]> {
  return db
    .select()
    .from(renders)
    .where(eq(renders.userId, userId))
    .orderBy(desc(renders.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

/**
 * صفوف قابلة لإعادة المحاولة من الطابور:
 * - `error` بمدخلات محفوظة ولم تستنفد محاولاتها (الفشل العادي).
 * - `queued` مهجور (انتهت مهلة الدالة التي حجزته) — وإلا بقي معلّقاً للأبد.
 *   هذا هو ما يجعل الطابور آمناً على منصة تُوقف الدوال طويلة التشغيل.
 */
export async function listRetryableRenders(
  db: Db,
  limit = 3,
  now = Date.now(),
): Promise<RenderRow[]> {
  const staleBefore = new Date(now - STALE_RENDER_MS);
  return db
    .select()
    .from(renders)
    .where(
      and(
        lt(renders.attempts, MAX_RENDER_ATTEMPTS),
        isNotNull(renders.inputProps),
        or(
          eq(renders.status, "error"),
          and(eq(renders.status, "queued"), lt(renders.updatedAt, staleBefore)),
        ),
      ),
    )
    .orderBy(renders.createdAt)
    .limit(limit);
}

/**
 * حجز صف لإعادة المحاولة بذرّة: ينتقل من الحالة المتوقَّعة إلى `queued`
 * فقط إن كان ما زال عليها. صفر صفوف = عملية أخرى سبقتنا (لا تصيير مزدوج).
 */
export async function claimRetry(
  db: Db,
  renderId: string,
  from: RenderStatus = "error",
): Promise<RenderRow | null> {
  try {
    const rows = await db
      .update(renders)
      .set({
        status: "queued",
        attempts: sql`${renders.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(renders.id, renderId),
          eq(renders.status, from),
          lt(renders.attempts, MAX_RENDER_ATTEMPTS),
        ),
      )
      .returning();
    return rows[0] ?? null;
  } catch (err) {
    // نفس المستخدم يُصيّر نفس الفيديو الآن (صف نشط آخر) ⇒ لا حاجة لإعادة
    // المحاولة الآن؛ يُعاد النظر في التشغيل التالي بدل إسقاط الطابور كله.
    if (isUniqueViolation(err, ACTIVE_RENDER_UNIQUE)) {
      return null;
    }
    throw err;
  }
}

/**
 * صفوف `running` مهجورة: التصيير التفاعلي مات مع عمليته (فلا أُغلق الصف).
 * **قراءة فقط** — لا نُعلن الفشل هنا: قد يكون الناتج رُفع إلى Blob ثم
 * انقطعت العملية قبل كتابة `done`. المستدعي يفحص الكاش أولاً ثم يُغلق
 * الصف (نجاحاً أو فشلاً + إرجاع) عبر `finishRender`/`refundRender` المشروطتين.
 */
export async function listStaleRunning(
  db: Db,
  now = Date.now(),
  limit = 25,
): Promise<RenderRow[]> {
  const staleBefore = new Date(now - STALE_RENDER_MS);
  return db
    .select()
    .from(renders)
    .where(
      and(
        eq(renders.status, "running"),
        isNull(renders.url),
        lt(renders.updatedAt, staleBefore),
      ),
    )
    .orderBy(renders.updatedAt)
    .limit(limit);
}

export async function recordUsage(
  db: Db,
  args: {
    userId: string;
    kind: UsageKind;
    units?: number;
    meta?: Record<string, unknown> | null;
  },
): Promise<void> {
  await db.insert(usageEvents).values({
    userId: args.userId,
    kind: args.kind,
    units: args.units ?? 1,
    meta: args.meta ?? null,
  });
}

export async function listUsage(
  db: Db,
  userId: string,
  limit = 50,
): Promise<Array<typeof usageEvents.$inferSelect>> {
  return db
    .select()
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId))
    .orderBy(desc(usageEvents.at))
    .limit(Math.min(Math.max(limit, 1), 200));
}

/** مجاميع الاستهلاك لكل نوع — تُغذّي لوحة الاستهلاك. */
export async function usageSummary(
  db: Db,
  userId: string,
): Promise<Array<{ kind: UsageKind; units: number }>> {
  const rows = await db
    .select({
      kind: usageEvents.kind,
      units: sql<number>`coalesce(sum(${usageEvents.units}), 0)::int`,
    })
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId))
    .groupBy(usageEvents.kind);
  return rows;
}

/** نتيجة `db.execute` تختلف في الشكل بين محرّكي Neon و PGlite — نستخرج `rows` بشكل واحد. */
function executedRows<TRow>(result: unknown): TRow[] {
  const rows = (result as { rows?: TRow[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

/**
 * تطبيق تلقيت كريدت من Stripe في **جملة SQL واحدة** بمنع تكرار مضمون:
 *
 * `WITH claimed AS (INSERT ... ON CONFLICT DO NOTHING)` ثم تحديث الرصيد
 * مشروطاً بوجود الحجز في نفس الجملة ⇒ إما يقع الحدث والتلقيت معاً أو لا
 * يقع أحدهما. هذا يُغلق خطرين معاً:
 * - **التكرار**: Stripe تعيد إرسال نفس الحدث عند أي رد غير 2xx؛ وجود
 *   المفتاح الأساسي يعني صفر صفوف مُحدَّثة ⇒ «مُعالج سابقاً».
 * - **التلقيت الجزئي**: لا توجد فترة بين «حجز» و«زيادة» يمكن أن تُقطع
 *   (تصيير upsert/delete المُتعاقب كان يمكن أن يفقد كريدت أو يمنحه مرتين).
 *
 * تُسجّل الاستهلاك بعد ذلك بشكل غير حرج: فشل التسجيل لا يؤثر على الكريدت.
 */
export async function applyStripeCreditGrant(
  db: Db,
  args: {
    eventId: string;
    type: string;
    userId: string;
    credits: number;
    /** معرّف جلسة الدفع — فريد في القاعدة: الحزمة تُمنح مرة لكل جلسة. */
    checkoutSessionId?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<{ applied: boolean; duplicate: boolean; credits: number }> {
  const sessionId = args.checkoutSessionId ?? null;
  // ON CONFLICT بلا هدف: يمتص تعارض المفتاح الأساسي (نفس الحدث) **و** تعارض
  // جلسة الدفع (حدث آخر لنفس الجلسة) معاً — كلاهما «مُعالج سابقاً».
  const result = await db.execute(sql`
    WITH claimed AS (
      INSERT INTO ${stripeEvents} (id, type, credits, user_id, checkout_session_id)
      VALUES (${args.eventId}, ${args.type}, ${args.credits}, ${args.userId}, ${sessionId})
      ON CONFLICT DO NOTHING
      RETURNING id
    )
    UPDATE ${users}
    SET credits = ${users.credits} + ${args.credits}, updated_at = now()
    WHERE ${users.id} = ${args.userId}
      AND EXISTS (SELECT 1 FROM claimed)
    RETURNING ${users.credits} AS credits
  `);

  const granted = executedRows<{ credits: number }>(result);
  if (granted.length === 0) {
    const existing = await db
      .select({ id: stripeEvents.id })
      .from(stripeEvents)
      .where(
        sessionId
          ? or(eq(stripeEvents.id, args.eventId), eq(stripeEvents.checkoutSessionId, sessionId))
          : eq(stripeEvents.id, args.eventId),
      )
      .limit(1);
    if (existing.length > 0) {
      return {
        applied: false,
        duplicate: true,
        credits: await getCredits(db, args.userId),
      };
    }
    throw new Error("تعذّر تطبيق تلقيت الكريدت: لم يُطابَق أي مستخدم.");
  }

  try {
    await recordUsage(db, {
      userId: args.userId,
      kind: "purchase",
      units: args.credits,
      meta: { eventId: args.eventId, checkoutSessionId: sessionId, ...(args.meta ?? {}) },
    });
  } catch (err) {
    console.warn("stripe: فشل تسجيل استهلاك الشراء (الكريدت مُطبَّق)", err);
  }

  return { applied: true, duplicate: false, credits: Number(granted[0].credits) };
}
