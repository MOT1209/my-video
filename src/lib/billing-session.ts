import type { RequestUser } from "./auth";
import { RENDER_CREDIT_COST } from "./credits";
import { getDb, type Db } from "./db/client";
import {
  addCredits,
  createRender,
  ensureUser,
  finishRender,
  getCredits,
  recordUsage,
  spendCredits,
  type UserRow,
} from "./db/repository";
import type { RenderStatus } from "./db/schema";

/**
 * جلسة فوترة لعملية تصيير واحدة.
 * القاعدة: **الكاش مجاني، التصيير الفعلي بكريدت واحد** — والكريدت يُخصم
 * قبل إنشاء الـ sandbox (لا بعد استخدام الموارد) ويُرجَع تلقائياً إذا فشل
 * التصيير. الإرجاع مرّة واحدة فقط مهما تكرّر النداء.
 */

export interface RenderStartArgs {
  compositionId: string;
  inputProps: Record<string, unknown> | null;
  cacheKey: string | null;
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
  /** خصم كريدت التصيير. */
  charge(): Promise<{ ok: boolean; credits: number }>;
  /** إرجاع الكريدت بعد فشل التصيير (مرة واحدة فقط). */
  refund(): Promise<void>;
  /** فتح صف تصيير في السجل — يُعيد معرّفه أو null عند تعذّر التسجيل. */
  startRender(args: RenderStartArgs): Promise<string | null>;
  finishRender(renderId: string | null, args: RenderFinishArgs): Promise<void>;
}

/**
 * يُعيد جلسة فوترة، أو null إذا تعذّر فرضها (لا DATABASE_URL).
 * تعطيل الفوترة **لا يمنع التصيير** — يمنعه فقط المصادقة (401) عند
 * تفعيل Clerk. الفرق مقصود: الفوترة طبقة أعمال، لا حدّ أمني.
 */
export async function openBillingSession(
  user: RequestUser,
  dbOverride?: Db | null,
): Promise<BillingSession | null> {
  const db = dbOverride === undefined ? getDb() : dbOverride;
  if (!db) {
    console.warn("billing: الكريدت غير مفروض — DATABASE_URL غير مهيأ.");
    return null;
  }

  const row: UserRow = await ensureUser(db, {
    clerkId: user.clerkId,
    email: user.email,
  });

  let charged = false;
  let refunded = false;

  const finishWithLog = async (renderId: string | null, args: RenderFinishArgs) => {
    if (!renderId) {
      return;
    }
    try {
      await finishRender(db, renderId, args);
    } catch (err) {
      console.warn("billing: فشل تحديث صف التصيير", err);
    }
  };

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

    async charge() {
      const result = await spendCredits(db, row.id, RENDER_CREDIT_COST);
      if (result.ok) {
        charged = true;
        try {
          await recordUsage(db, {
            userId: row.id,
            kind: "render",
            units: RENDER_CREDIT_COST,
          });
        } catch (err) {
          console.warn("billing: فشل تسجيل استهلاك التصيير", err);
        }
      }
      return result;
    },

    async refund() {
      if (!charged || refunded) {
        return;
      }
      refunded = true;
      try {
        await addCredits(db, row.id, RENDER_CREDIT_COST);
      } catch (err) {
        console.error("billing: فشل إرجاع الكريدت بعد فشل التصيير", err);
      }
    },

    async startRender(args) {
      try {
        const created = await createRender(db, {
          userId: row.id,
          projectId: args.projectId ?? null,
          compositionId: args.compositionId,
          inputProps: args.inputProps,
          cacheKey: args.cacheKey,
          status: "running",
          creditsUsed: RENDER_CREDIT_COST,
        });
        return created.id;
      } catch (err) {
        console.warn("billing: فشل فتح صف تصيير في السجل", err);
        return null;
      }
    },

    finishRender: finishWithLog,
  };
}
