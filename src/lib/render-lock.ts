/**
 * قفل موزّع لمنع التصييرات المتوازية (المرحلة 3 — بند #3):
 * مستخدماً واحد = عملية تصيير واحدة في أي لحظة، عبر كل نسخ Vercel
 * (بخلافاً لمحدّد المعدل، الاصطدام هنا يعني آكدتو هم sandbox مشاً فعلياً).
 *
 * التنفيذ:‏ SET key <token> NX EX ttl على Upstash Redis عند وجود المفاتيح،
 * وإلا خريطة محلية (تؤمّن التطوير وسلوكًا 1:1 قبل الإعداد).
 * الـ TTL يضمن التحّرير التلقائي إن ماتت العملية قبل فتح القفل.
 */

import { inMemoryRateLimitAllowed } from "./rate-limit";
import { getUpstashRedis } from "./upstash-redis";

/** مدة حياة القفل القسري (تصيير فعلي يكمل عادة بدقائق). */
export const RENDER_LOCK_TTL_SEC = 600;

/** مقترح إعادة المحاولة لصاحب القفل (تصيير عادة يكمل خلال دقائق). */
export const RENDER_LOCK_RETRY_SEC = 60;

const localLocks = new Map<string, { token: string; heldUntil: number }>();

/**
 * تحرير ذرّي بالمالك: يحذف المفتاح فقط إن كان ما زال يحمل رمز صاحب القفل.
 * بدونه يحذف تصيير طال أكثر من الـ TTL قفلَ تصيير أحدث لنفس المستخدم،
 * فيبدأ ثالث بالتوازي (sandbox إضافي مدفوع).
 */
const RELEASE_IF_OWNER =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

export type RenderLockResult =
  | { acquired: true; token: string }
  | { acquired: false; reason: "held" | "unavailable" };

/**
 * يحاول أخذ القفل ويعيد رمز المالك عند النجاح.
 *
 * عند تعذّر Upstash: في التطوير سقوط للذاكرة المحلية، وفي الإنتاج رفض مغلق
 * (`unavailable`) كما يفعل محدّد المعدل — قفل في ذاكرة نسخة واحدة لا يمنع
 * تصييرين متوازيين على نسختين. الفتح الصريح `RATE_LIMIT_ALLOW_IN_MEMORY=true`
 * يعيد السقوط المحلي في الإنتاج.
 */
export async function acquireRenderLock(
  key: string,
  now = Date.now(),
): Promise<RenderLockResult> {
  const token = `${now}:${crypto.randomUUID()}`;
  const redis = getUpstashRedis();
  if (redis) {
    try {
      const result = (await redis.set(key, token, {
        nx: true,
        ex: RENDER_LOCK_TTL_SEC,
      })) as unknown;
      const ok =
        result === "OK" || (result as { ok?: string } | null)?.ok === "OK";
      return ok ? { acquired: true, token } : { acquired: false, reason: "held" };
    } catch (err) {
      if (!inMemoryRateLimitAllowed()) {
        console.error("render-lock: فشل Upstash في الإنتاج — رفض مغلق", err);
        return { acquired: false, reason: "unavailable" };
      }
      console.warn("render-lock: فشل Upstash — سقوط محلي (ذاكرة)", err);
    }
  }
  const held = localLocks.get(key);
  if (held && held.heldUntil > now) {
    return { acquired: false, reason: "held" };
  }
  localLocks.set(key, { token, heldUntil: now + RENDER_LOCK_TTL_SEC * 1000 });
  return { acquired: true, token };
}

/** يُحرّر القفل إن كان ما زال لنفس المالك (عند اكتمال التصيير، نجاحاً أو فشلاً). */
export async function releaseRenderLock(key: string, token: string): Promise<void> {
  const redis = getUpstashRedis();
  if (redis) {
    try {
      await redis.eval(RELEASE_IF_OWNER, [key], [token]);
    } catch (err) {
      // القفل ينتهي وحده بعد الـ TTL؛ لا حذف أعمى هنا
      console.warn("render-lock: فشل تحرير القفل في Upstash", err);
    }
  }
  if (localLocks.get(key)?.token === token) {
    localLocks.delete(key);
  }
}
