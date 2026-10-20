import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "../../../../helpers/api-response";
import { getDb } from "../../../../lib/db/client";
import { MAX_RENDER_ATTEMPTS } from "../../../../lib/db/repository";
import { findCachedRender } from "../../../../lib/render-cache";
import { resolveStaleRenders, retryFailedRenders } from "../../../../lib/render-recovery";
import { runRenderOnce } from "../../../../lib/render-runner";

/**
 * طابور التصيير (بند #3 من المرحلة 3) — يُنادى من Vercel Cron.
 *
 * مهمتان:
 * 1) **حسم الصفوف المعلّقة**: عملية تصيير ماتت مع دالتها (انتهت المهلة)
 *    فلم يُغلق الصف. نفحص الكاش أولاً: إن كان الناتج قد رُفع (انقطعت العملية
 *    بعد الرفع وقبل كتابة `done`) يُغلق ناجحاً بلا إرجاع؛ وإلا يُرجَع
 *    الكريدت (مرة واحدة، `refunded_at`) ثم يُعلن فاشلاً.
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

  const findCached = (path: string) => findCachedRender(path, blobToken);

  // 1) صفوف التصيير المعلّقة ⇒ ناجحة إن وُجد ناتجها، وإلا إرجاع ثم فشل
  const stale = await resolveStaleRenders(db, findCached);

  // 2) إعادة محاولة الفاشل (بحدّ المحاولات) مع فحص الكاش أولاً
  const results = await retryFailedRenders(db, {
    findCached,
    render: ({ compositionId, inputProps, blobPath, userId }) =>
      runRenderOnce({
        compositionId,
        inputProps,
        blobPath,
        blobToken,
        sessionKey: `render-sandbox:retry:${userId}`,
      }),
  });

  return NextResponse.json({
    received: true,
    ...stale,
    attempted: results.length,
    maxAttempts: MAX_RENDER_ATTEMPTS,
    results,
  });
}
