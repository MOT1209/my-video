import { BlobAccessError } from "@vercel/blob";

/** يترجم خطأ مخزن Blob الخاص إلى رسالة عربية واضحة قابلة للتنفيذ. */
export function friendlyRenderError(err: unknown): string {
  const message = (err as Error)?.message ?? String(err);
  if (
    err instanceof BlobAccessError ||
    message.includes("public access on a private store")
  ) {
    return "مخزن Blob خاص (private) والتطبيق يحتاج رفعاً عاماً. من Vercel Dashboard افتح Storage ثم إعدادات الـ Blob store واسمح بالوصول العام ثم أعد النشر.";
  }
  return message;
}

/** هل الخطأ يشير إلى sandbox توقف/انتهى (فقط حينها تستفيد إعادة المحاولة)؟ */
export function isStoppedSandboxError(err: unknown): boolean {
  const message = (err as Error)?.message ?? String(err);
  return (
    message.includes("sandbox_stopped") ||
    message.includes("sandbox stopped") ||
    message.includes("expired")
  );
}
