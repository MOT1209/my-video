import { BlobAccessError } from "@vercel/blob";
import {
  isSandboxSnapshotUnavailableError,
  isSnapshotStorageQuotaError,
} from "./snapshot-errors";

/** رسالة عامة لفشل التصيير — التفاصيل في سجل الخادم فقط. */
export const GENERIC_RENDER_ERROR =
  "تعذّر تصيير الفيديو. تحقّق من روابط الوسائط (صورة/فيديو/صوت) ثم أعد المحاولة؛ أُرجع الكريدت إن كان قد خُصم.";

const BLOB_PRIVATE_STORE_MESSAGE =
  "مخزن Blob خاص (private) والتطبيق يحتاج رفعاً عاماً. من Vercel Dashboard افتح Storage ثم إعدادات الـ Blob store واسمح بالوصول العام ثم أعد النشر.";

function errorText(err: unknown): string {
  return (err as Error)?.message ?? String(err);
}

/**
 * يترجم خطأ التصيير إلى رسالة آمنة للعرض والحفظ في `renders.error`.
 * رسائل sandbox/Remotion الخام قد تحمل مسارات داخلية وروابط وتفاصيل
 * البنية، فلا تُعرض أبداً — فقط الحالات المعروفة القابلة للتنفيذ.
 */
export function friendlyRenderError(err: unknown): string {
  const message = errorText(err);
  if (
    err instanceof BlobAccessError ||
    message.includes("public access on a private store")
  ) {
    return BLOB_PRIVATE_STORE_MESSAGE;
  }
  return GENERIC_RENDER_ERROR;
}

/** هل الخطأ يشير إلى sandbox توقف/انتهى (فقط حينها تستفيد إعادة المحاولة)؟ */
export function isStoppedSandboxError(err: unknown): boolean {
  const message = errorText(err).toLowerCase();
  return (
    message.includes("sandbox_stopped") ||
    message.includes("sandbox stopped") ||
    message.includes("sandbox_expired") ||
    // "expired" وحدها واسعة جداً (رابط وسائط منتهٍ مثلاً خطأ محتوى لا بنية)
    /sandbox[^.]{0,40}expired/.test(message)
  );
}

const TRANSIENT_NETWORK_CODES = [
  "econnreset",
  "etimedout",
  "econnrefused",
  "eai_again",
  "socket hang up",
  "fetch failed",
  "503 service unavailable",
  "502 bad gateway",
];

/**
 * هل يستحق الفشل إعادة محاولة من طابور الـ cron؟
 *
 * فقط أعطال البنية (sandbox توقف، snapshot غائب، شبكة عابرة). فشل المحتوى
 * (رابط وسائط بطيء/معطوب، مدخلات تكسر Remotion) نهائي: الكريدت أُرجع،
 * وإعادة المحاولة المجانية تتيح حرق دقائق sandbox بلا كلفة على المستخدم.
 * غير المعروف يُعامل كغير قابل لإعادة المحاولة (الخيار الآمن للكلفة).
 */
export function isRetryableRenderError(err: unknown): boolean {
  if (err instanceof BlobAccessError) {
    return false;
  }
  if (
    isStoppedSandboxError(err) ||
    isSandboxSnapshotUnavailableError(err) ||
    isSnapshotStorageQuotaError(err)
  ) {
    return true;
  }
  const message = errorText(err).toLowerCase();
  const code = String((err as { code?: unknown })?.code ?? "").toLowerCase();
  return TRANSIENT_NETWORK_CODES.some(
    (needle) => message.includes(needle) || code === needle,
  );
}
