import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "../../../../helpers/api-response";
import { getDb } from "../../../../lib/db/client";
import {
  addCredits,
  claimRetry,
  finishRender,
  listRetryableRenders,
  MAX_RENDER_ATTEMPTS,
  reclaimStaleRunning,
} from "../../../../lib/db/repository";
import { findCachedRender, renderCachePath } from "../../../../lib/render-cache";
import { friendlyRenderError } from "../../../../lib/render-errors";
import { runRenderOnce } from "../../../../lib/render-runner";

/**
 * طابور التصيير (بند #3 من المرحلة 3) — يُنادى من Vercel Cron.
 *
 * مهمتان:
 * 1) **إعادة الصفوف المعلّقة**: عملية تصيير ماتت مع دالتها (انتهت المهلة)
 *    فلا وصل ناتج ولا أُغلق الصف. تُعلَن فاشلة ويُرجع كريدتها للعميل —
 *    وإلا دفع المستخدم مقابل لا شيء.
 * 2) **إعادة محاولة الفاشل** ذي المدخلات المحفوظة، بحدّ `MAX_RENDER_ATTEMPTS`،
 *    مع فحص الكاش أولاً (قد يكون التصيير نجح فعلاً في محاولة سابقة).
 *
 * ملاحظة كلفة: إعادة المحاولة مجانية للمستخدم — الكريدت يُرجع أصلاً عند
 * فشل التصيير، وهذا الطابور تعويض بنائي محدود (≤ 3 محاولات لكل صف فاشل)
 * يمنع بقاء المستخدم بلافيديو بلا سبب.
 *
 * الحماية: `CRON_SECRET` إلزامي (Vercel يرسل `Authorization: Bearer …`).
 */
export const maxDuration = 300;

/** مقارنة بزمن ثابت كي لا يتسرّب السر عبر زمن الرد. */
function secretMatches(received: string | null, expected: string): boolean {
  if (received === null) {
    return false;
  }
  const encoder = new TextEncoder();
  const a = encoder.encode(received);
  const b = encoder.encode(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return apiError("CRON_SECRET غير مهيأ — مسار الطابور معطّل.", 503);
  }
  if (!secretMatches(req.headers.get("authorization"), `Bearer ${cronSecret}`)) {
    return apiError("غير مصرّح.", 401);
  }

  const db = getDb();
  if (!db) {
    return apiError("DATABASE_URL غير مهيأ — الطابور يحتاج قاعدة بيانات.", 503);
  }
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return apiError("BLOB_READ_WRITE_TOKEN غير مهيأ.", 503);
  }

  // 1) صفوف التصيير المعلّقة ⇒ فاشلة + إرجاع الكريدت
  const stale = await reclaimStaleRunning(db);
  let refundedCredits = 0;
  for (const row of stale) {
    if (row.creditsUsed > 0) {
      try {
        await addCredits(db, row.userId, row.creditsUsed);
        refundedCredits += row.creditsUsed;
      } catch (err) {
        console.error("cron/retry-renders: فشل إرجاع كريدت صف معلّق", err);
      }
    }
  }

  // 2) إعادة محاولة الفاشل (بحدّ المحاولات) مع فحص الكاش أولاً
  const candidates = await listRetryableRenders(db);
  const results: Array<Record<string, unknown>> = [];
  for (const row of candidates) {
    const claimed = await claimRetry(db, row.id, row.status);
    if (!claimed) {
      results.push({ id: row.id, status: "skipped" });
      continue;
    }
    const cachePath =
      claimed.cacheKey ??
      renderCachePath(claimed.compositionId, claimed.inputProps ?? {});

    try {
      const cached = await findCachedRender(cachePath, blobToken);
      if (cached) {
        await finishRender(db, claimed.id, {
          status: "done",
          url: cached.url,
          sizeBytes: cached.size,
        });
        results.push({ id: claimed.id, status: "done", cached: true });
        continue;
      }

      const outcome = await runRenderOnce({
        compositionId: claimed.compositionId,
        inputProps: claimed.inputProps ?? {},
        blobPath: cachePath,
        blobToken,
        sessionKey: `render-sandbox:retry:${claimed.userId}`,
      });
      await finishRender(db, claimed.id, {
        status: "done",
        url: outcome.url,
        sizeBytes: outcome.size,
        sandboxMs: outcome.sandboxWallSeconds * 1000,
      });
      results.push({ id: claimed.id, status: "done", cached: false });
    } catch (err) {
      const message = friendlyRenderError(err);
      console.error("cron/retry-renders: فشلت إعادة المحاولة", err);
      await finishRender(db, claimed.id, { status: "error", error: message });
      results.push({ id: claimed.id, status: "error", error: message });
    }
  }

  return NextResponse.json({
    received: true,
    reclaimed: stale.length,
    refundedCredits,
    attempted: results.length,
    maxAttempts: MAX_RENDER_ATTEMPTS,
    results,
  });
}
