/**
 * قفل موزّع لمنع التصييرات المتوازية (المرحلة 3 — بند #3):
 * مستخدماً واحد = عملية تصيير واحدة في أي لحظة، عبر كل نسخ Vercel
 * (بخلافاً لمحدّد المعدل، الاصطدام هنا يعني آكدتو هم sandbox مشاً فعلياً).
 *
 * التنفيذ:‏ SET key NX EX ttl على Upstash Redis عند وجود المفاتيح،
 * وإلا خريطة محلية (تؤمّن التطوير وسلوكًا 1:1 قبل الإعداد).
 * الـ TTL يضمن التحّرير التلقائي إن ماتت العملية قبل فتح القفل.
 */

import { getUpstashRedis } from "./upstash-redis";

/** مدة حياة القفل القسري (تصيير فعلي يكمل عادة بدقائق). */
export const RENDER_LOCK_TTL_SEC = 600;

/** مقترح إعادة المحاولة لصاحب القفل (تصيير عادة يكمل خلال دقائق). */
export const RENDER_LOCK_RETRY_SEC = 60;

const localLocks = new Map<string, number>();

/**
 * يحاول فعل القفل. يُعيد true عند نجاح الاستناد، false إن كان القفل
 * مثبتاً لديه بالفُعل منحًشية أخرى جارِية.
 * أخطاء Upstash (شبكة...) تُسيطر على الذاكرة المحلية — لا رمي.
 */
/** معامل `now` قابل للحقن لاختبار سلوك الـ TTL المحلي بلا انتظار. */
export async function acquireRenderLock(
  key: string,
  now = Date.now(),
): Promise<boolean> {
  const redis = getUpstashRedis();
  if (redis) {
    try {
      const owner = `lock:${now}`;
      const result = (await redis.set(key, owner, {
        nx: true,
        ex: RENDER_LOCK_TTL_SEC,
      })) as unknown;
      return result === "OK" || (result as { ok?: string } | null)?.ok === "OK";
    } catch (err) {
      console.warn("render-lock: فشل Upstash — سقوط محلي (ذاكرة)", err);
    }
  }
  const heldUntil = localLocks.get(key);
  if (heldUntil && heldUntil > now) {
    return false;
  }
  localLocks.set(key, now + RENDER_LOCK_TTL_SEC * 1000);
  return true;
}

/** يُحرّر القفل (عند اكتمال التصيير — نجاحاً أو فشلاً). */
export async function releaseRenderLock(key: string): Promise<void> {
  const redis = getUpstashRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch (err) {
      console.warn("render-lock: فشل تحرير القفل في Upstash", err);
      localLocks.delete(key);
    }
  }
  localLocks.delete(key);
}
