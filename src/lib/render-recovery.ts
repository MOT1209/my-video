import type { Db } from "./db/client";
import {
  claimRetry,
  finishRender,
  listRetryableRenders,
  listStaleRunning,
  refundRender,
} from "./db/repository";
import { renderCachePath } from "./render-cache";
import { friendlyRenderError } from "./render-errors";
import type { RunRenderOutcome } from "./render-runner";

/**
 * منطق طابور التصيير (يُنادى من Vercel Cron) مفصولاً عن مسار Next كي
 * يُختبر على Postgres حقيقي بلا mock.module.
 *
 * آلة الحالات المسموحة (كل انتقال جملة SQL مشروطة):
 *   running ─(نجاح)→ done            [finishRender from running]
 *   running ─(فشل + إرجاع)→ error    [refundRender ثم finishRender from running]
 *   running ─(مهجور + ناتج في الكاش)→ done   [هنا]
 *   running ─(مهجور بلا ناتج)→ error + إرجاع  [هنا]
 *   error/queued(مهجور) ─(حجز، attempts+1 < حد)→ queued [claimRetry]
 *   queued ─(نجاح/فشل بنفس رقم المحاولة)→ done/error [finishRender + fence]
 *   done: نهائي — لا يُكتب فوقه ولا يُرجع كريدته.
 */

export type FindCached = (cachePath: string) => Promise<{ url: string; size: number } | null>;

export interface StaleResolution {
  reclaimed: number;
  recoveredDone: number;
  refundedCredits: number;
}

/**
 * حسم الصفوف `running` المهجورة: ناجحة إن وُجد ناتجها في الكاش (انقطعت
 * العملية بعد الرفع وقبل كتابة `done`) — وإلا إرجاع الكريدت مرة واحدة ثم
 * إعلان الفشل. أي خطأ في صف يتركه running ليُعاد في التشغيل التالي.
 */
export async function resolveStaleRenders(
  db: Db,
  findCached: FindCached,
  now = Date.now(),
): Promise<StaleResolution> {
  const stale = await listStaleRunning(db, now);
  let refundedCredits = 0;
  let recoveredDone = 0;
  for (const row of stale) {
    try {
      const cached = row.cacheKey ? await findCached(row.cacheKey) : null;
      if (cached) {
        if (
          await finishRender(
            db,
            row.id,
            { status: "done", url: cached.url, sizeBytes: cached.size },
            { from: ["running"] },
          )
        ) {
          recoveredDone += 1;
        }
        continue;
      }
      // الإرجاع أولاً: إن فشل يبقى الصف running ويُعاد في التشغيل التالي
      const refund = await refundRender(db, row.id);
      if (refund.refunded) {
        refundedCredits += row.creditsUsed;
      }
      await finishRender(
        db,
        row.id,
        { status: "error", error: "انتهت مهلة العملية قبل إغلاق صف التصيير." },
        { from: ["running"] },
      );
    } catch (err) {
      console.error("render-recovery: فشل حسم صف معلّق — يُعاد لاحقاً", (err as Error)?.message);
    }
  }
  return { reclaimed: stale.length, recoveredDone, refundedCredits };
}

export interface RetryResult {
  id: string;
  status: "done" | "error" | "skipped";
  cached?: boolean;
  error?: string;
}

/**
 * إعادة محاولة الفاشل ذي المدخلات المحفوظة (بحدّ `MAX_RENDER_ATTEMPTS`)،
 * مع فحص الكاش أولاً. كل كتابة محصورة بـ fencing (`attempts`): عامل حجز
 * الصف ثم تأخر لا يُفسد نتيجة محاولة أحدث.
 *
 * ملاحظة كلفة (قرار منتج قائم): الكريدت أُرجع عند الفشل، فنجاح إعادة
 * المحاولة مجاني للمستخدم — تعويض محدود (≤ 3 محاولات للصف).
 */
export async function retryFailedRenders(
  db: Db,
  deps: {
    findCached: FindCached;
    render: (args: {
      compositionId: string;
      inputProps: Record<string, unknown>;
      blobPath: string;
      userId: string;
    }) => Promise<RunRenderOutcome>;
  },
  now = Date.now(),
): Promise<RetryResult[]> {
  const candidates = await listRetryableRenders(db, 3, now);
  const results: RetryResult[] = [];
  for (const row of candidates) {
    const claimed = await claimRetry(db, row.id, row.status);
    if (!claimed) {
      results.push({ id: row.id, status: "skipped" });
      continue;
    }
    const cachePath =
      claimed.cacheKey ??
      renderCachePath(claimed.compositionId, claimed.inputProps ?? {});
    // fencing: الكتابة تخص هذه المحاولة فقط (عامل أقدم/أحدث لا يُفسدها)
    const fence = { from: ["queued" as const], attempts: claimed.attempts };

    try {
      const cached = await deps.findCached(cachePath);
      if (cached) {
        await finishRender(
          db,
          claimed.id,
          { status: "done", url: cached.url, sizeBytes: cached.size },
          fence,
        );
        results.push({ id: claimed.id, status: "done", cached: true });
        continue;
      }

      const outcome = await deps.render({
        compositionId: claimed.compositionId,
        inputProps: claimed.inputProps ?? {},
        blobPath: cachePath,
        userId: claimed.userId,
      });
      await finishRender(
        db,
        claimed.id,
        {
          status: "done",
          url: outcome.url,
          sizeBytes: outcome.size,
          sandboxMs: outcome.sandboxWallSeconds * 1000,
        },
        fence,
      );
      results.push({ id: claimed.id, status: "done", cached: false });
    } catch (err) {
      const message = friendlyRenderError(err);
      console.error("render-recovery: فشلت إعادة المحاولة", (err as Error)?.message);
      await finishRender(db, claimed.id, { status: "error", error: message }, fence).catch(
        (finishErr) => {
          console.error("render-recovery: فشل إغلاق صف فاشل", (finishErr as Error)?.message);
        },
      );
      results.push({ id: claimed.id, status: "error", error: message });
    }
  }
  return results;
}
