import type { RequestUser } from "./auth";
import { RENDER_CREDIT_COST } from "./credits";
import { getDb, type Db } from "./db/client";
import {
  ensureUser,
  finishRender,
  getCredits,
  refundRender,
  startChargedRender,
  type StartChargedRenderResult,
  type UserRow,
} from "./db/repository";
import type { RenderStatus } from "./db/schema";

/**
 * جلسة فوترة لعملية تصيير واحدة.
 * القاعدة: **الكاش مجاني، التصيير الفعلي بكريدت واحد** — والكريدت يُخصم
 * قبل إنشاء الـ sandbox (لا بعد استخدام الموارد) ويُرجَع تلقائياً إذا فشل
 * التصيير.
 *
 * كل الضمانات محفوظة **في قاعدة البيانات** لا في ذاكرة العملية:
 * - الخصم وفتح صف التصيير وتسجيل الاستهلاك جملة SQL واحدة.
 * - الإرجاع مرة واحدة لكل صف (`refunded_at`) مهما تكرّر من أي عملية،
 *   ولا يقع لصف اكتمل (`done`).
 * - الإغلاق مشروط بأن الصف ما زال مفتوحاً (لا كتابة فوق نتيجة نهائية).
 */

export interface RenderStartArgs {
  compositionId: string;
  inputProps: Record<string, unknown> | null;
  cacheKey: string;
  projectId?: string | null;
}

export interface RenderFinishArgs {
  status: RenderStatus;
  url?: string | null;
  sizeBytes?: number | null;
  durationSec?: number | null;
  sandboxMs?: number | null;
  error?: string | null;
}

export interface BillingSession {
  userId: string;
  /** الرصيد الحالي — يُعاد للعميل في رسالة النجاح لتحديث الواجهة. */
  balance(): Promise<number>;
  /** خصم كريدت التصيير وفتح صفّه ذرّياً (أو رفض: رصيد/تكرار). */
  startPaidRender(args: RenderStartArgs): Promise<StartChargedRenderResult>;
  /**
   * إرجاع كريدت صف فشل تصييره (idempotent عبر العمليات).
   * false = تعذّر الوصول للقاعدة: لا تُغلق الصف فاشلاً عندها، كي يبقى
   * `running` فيلتقطه الطابور ويُرجع الكريدت لاحقاً.
   */
  refund(renderId: string): Promise<boolean>;
  /** إغلاق الصف — يُعيد false إن كان قد أُغلق سابقاً (لا كتابة فوقه). */
  finishRender(renderId: string, args: RenderFinishArgs): Promise<boolean>;
}

/**
 * يُعيد جلسة فوترة، أو null إذا تعذّر فرضها (لا DATABASE_URL).
 * القرار فيما إذا كان غياب الفوترة مقبولاً يقع على المسار
 * (`billingRequiredResponse` في الإنتاج) لا هنا.
 */
export async function openBillingSession(
  user: RequestUser,
  dbOverride?: Db | null,
): Promise<BillingSession | null> {
  const db = dbOverride === undefined ? getDb() : dbOverride;
  if (!db) {
    return null;
  }

  const row: UserRow = await ensureUser(db, {
    clerkId: user.clerkId,
    email: user.email,
  });

  return {
    userId: row.id,

    async balance() {
      try {
        return await getCredits(db, row.id);
      } catch (err) {
        console.warn("billing: فشل قراءة الرصيد", err);
        return 0;
      }
    },

    startPaidRender(args) {
      return startChargedRender(db, {
        userId: row.id,
        cost: RENDER_CREDIT_COST,
        compositionId: args.compositionId,
        inputProps: args.inputProps,
        cacheKey: args.cacheKey,
        projectId: args.projectId ?? null,
      });
    },

    async refund(renderId) {
      try {
        await refundRender(db, renderId);
        return true;
      } catch (err) {
        // الصف يبقى بلا refunded_at ⇒ يلتقطه الطابور (صف running مهجور) ويُرجعه لاحقاً
        console.error("billing: فشل إرجاع الكريدت — سيُعاد عبر الطابور", err);
        return false;
      }
    },

    async finishRender(renderId, args) {
      try {
        return await finishRender(db, renderId, args, { from: ["running"] });
      } catch (err) {
        // الصف يبقى running ⇒ الطابور يحسمه لاحقاً (يفحص الكاش قبل أي إرجاع)
        console.warn("billing: فشل تحديث صف التصيير — سيحسمه الطابور", err);
        return false;
      }
    },
  };
}
