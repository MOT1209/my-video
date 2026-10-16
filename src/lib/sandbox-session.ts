import type { Sandbox } from "@vercel/sandbox";

/**
 * جلسة sandbox (المرحلة 3 — تحسين #2):
 * بدل stop() بعد كل طلب تصيير، نُبقي الـ sandbox حياً فترة خمول قصيرة،
 * فإذا طلب المستخدم تصييراً آخر (تعديل صغير ثم إعادة) نعيد استخدام
 * الجلسة نفسها — صفر وقت إنشاء/تثبيتات/متصفح، وتوفير درز كبير في
 * تكلفة sandbox أثناء التكرار على نفس المشروع.
 *
 * ملاحظات بيئة التشغيل:
 * - في serverless قد تنتهي حياة العملية قبل إطلاق مؤقّت الخمول؛ لذا
 *   الصيانة تعمل أيضاً عند كل طلب عبر stopStaleSandboxSessions().
 * - الـ sandbox نفسه له timeout من Vercel؛ نمدده عند كل إعادة استخدام
 *   (extendTimeout) وإلا انتهى تلقائياً بعد دقائق.
 * - إن كان المرجع المحفوظ قديماً وانتهى فعلاً، يفشل التصيير بخطأ
 *   "stopped" ويُعاد بلوحة إنشاء جديدة (منطق إعادة المحاولة في route.ts).
 */

/** مدة الخمول قبل إيقاف الـ sandbox (مللي ثانية). */
export const SANDBOX_IDLE_STOP_MS = 90_000;

interface SessionEntry {
  sandbox: Sandbox;
  createdAtMs: number;
  lastUsedMs: number;
}

const sessions = new Map<string, SessionEntry>();

/** يمنح key قصيراً آمناً للسجلات. */
const shortKey = (key: string): string =>
  key.length > 12 ? `${key.slice(0, 8)}…` : key;

/**
 * يوقف ويحذف الجلسات الخاملة بما يتجاوز TTL — يُستدعى عند كل طلب
 * كشرط احتياطي إن لم يعمل مؤقّت الخمول (مثلاً تعليق دالة serverless).
 * يُعيد عدد الجلسات التي أُوقفت.
 */
export function stopStaleSandboxSessions(now = Date.now()): number {
  let stopped = 0;
  for (const [key, entry] of sessions) {
    if (now - entry.lastUsedMs >= SANDBOX_IDLE_STOP_MS) {
      sessions.delete(key);
      void entry.sandbox.stop().catch(() => {});
      stopped += 1;
      console.log(`sandbox-session: أوقفنا جلسة خاملة (${shortKey(key)})`);
    }
  }
  return stopped;
}

/**
 * يجلب الـ sandbox المحفوظ لهذه الجلسة إن وجد ولم ينتهِ خموله.
 * لا يُعدّل الحالة (plumbing الـ hold يجدها بعد اكتمال التصيير).
 */
export function acquireSessionSandbox(key: string): Sandbox | null {
  stopStaleSandboxSessions();
  const entry = sessions.get(key);
  if (!entry) {
    return null;
  }
  return entry.sandbox;
}

/**
 * يحفظ/يُجدّد الجلسة بعد نجاح تصيير: يُمدّد timeout الـ sandbox
 * كي لا ينتهي تلقائياً أثناء فترة الخمول، ويسجّل الخمول الجديد.
 */
export function holdSessionSandbox(
  key: string,
  sandbox: Sandbox,
  extendTimeoutMs: number,
  now = Date.now(),
): void {
  const createdAtMs = sessions.get(key)?.createdAtMs ?? now;
  sessions.set(key, { sandbox, createdAtMs, lastUsedMs: now });
  if (extendTimeoutMs > 0) {
    void sandbox.extendTimeout(extendTimeoutMs).catch((err) => {
      console.warn("sandbox-session: فشل تمديد timeout", err);
    });
  }
  // مؤقت صيانة احتياطي: في serverless قد تموت العملية قبله، لكنه يعمل
  // في الـ dev المحلي ويُبقي المدينة نظيفة في الحالتين. unref كي لا
  // يُبقي العملية حية وحدّه.
  const timer = setTimeout(() => stopStaleSandboxSessions(), SANDBOX_IDLE_STOP_MS);
  timer.unref?.();
  console.log(
    `sandbox-session: نُبقي الجلسة حية (${shortKey(key)}) لإعادة استخدام محتملة`,
  );
}

/**
 * يُنهي الجلسة يدوياً — عند الخطأ أو عند التخلي عن إعادة الاستخدام.
 */
export async function dropSessionSandbox(key: string): Promise<void> {
  const entry = sessions.get(key);
  if (!entry) {
    return;
  }
  sessions.delete(key);
  await entry.sandbox.stop().catch(() => {});
  console.log(`sandbox-session: أُنهيت الجلسة (${shortKey(key)})`);
}

/** مدة حياة الجلسة بالثواني (الفوترة تتراكم منذ الإنشاء) — للقياس. */
export function sandboxSessionLifetimeSeconds(
  key: string,
  now = Date.now(),
): number | null {
  const entry = sessions.get(key);
  if (!entry) {
    return null;
  }
  return Math.round((now - entry.createdAtMs) / 1000);
}
