import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import { getUpstashRedis } from "./upstash-redis";

/**
 * حد المعدل عبر Upstash Redis‏ (@upstash/ratelimit + REST):
 * نافذة ثابتة (fixedWindow) تُحصى في Redis — صحيحة عبر كل نسخ
 * Vercel (خلافاً للمحدِّد القديم في الذاكرة الذي كان معدّاً لكل نسخة
 * منفردة، فيتنفطق مع التوسع).
 *
 * السلوك:
 * - وجدت UPSTASH_REDIS_REST_URL/TOKEN → مسار Upstash.
 * - لا مفاتيحَين خارج الإنتاج → نافذة محلية للتطوير فقط.
 * - إنتاج بلا إعداد أو مع خطأ Upstash → رفض fail-closed بدلاً من تجاوز الحد.
 * - أخطاء Upstash خارج الإنتاج → ذاكرة محلية لتيسير التطوير فقط.
 *
 * فرض مرئي: نافذة Upstash الثابتة تُحاذي حدود الزمن المطلق (أضعاف windowMs)
 * بينما النوافذ المحلية تبدأ من أول طلب — فروق دقيقة فقط في حواف النافذة.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** منطق النوافذ الثابتة المحلي — مُستخرج للاختبار والسقوط الاحتياطي. */
export function inMemoryCheckRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; retryAfterSec: number } {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (current.count < limit) {
    current.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  }
  return {
    allowed: false,
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * تدُعم @upstash/ratelimit دائماً ثوابت limit/window محددة لحالاتها،
 * فنُنشئ نسخة Ratelimit لكل (limit, window) مُستخدمة — مخزنة مرة واحدة.
 */
const upstashInstances = new Map<string, Ratelimit>();

function getUpstashRatelimit(limit: number, windowMs: number): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) {
    return null;
  }
  const cacheKey = `${limit}:${windowMs}`;
  let instance = upstashInstances.get(cacheKey);
  if (!instance) {
    instance = new Ratelimit({
      redis,
      // نوافذ دائماً بأعداد صحيحة من الثواني (حدودنا كلها ≥ دقيقة)
      limiter: Ratelimit.fixedWindow(limit, `${Math.max(1, Math.round(windowMs / 1000))} s`),
      prefix: "@my-video/ratelimit",
      // بلا analytics: كي لا تتطلب المهام الخلفية waitUntil بعد الرد
      analytics: false,
    });
    upstashInstances.set(cacheKey, instance);
  }
  return instance;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  unavailable?: boolean;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const ratelimit = getUpstashRatelimit(limit, windowMs);
  if (ratelimit) {
    try {
      const res = await ratelimit.limit(key);
      return {
        allowed: res.success,
        retryAfterSec: res.success
          ? 0
          : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
      };
    } catch (err) {
      console.warn("rate-limit: فشل Upstash", err);
      if (process.env.NODE_ENV === "production") {
        return { allowed: false, retryAfterSec: 0, unavailable: true };
      }
    }
  } else if (process.env.NODE_ENV === "production") {
    return { allowed: false, retryAfterSec: 0, unavailable: true };
  }
  return inMemoryCheckRateLimit(key, limit, windowMs);
}

export function rateLimitUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { type: "error", message: "الخدمة غير متاحة مؤقتاً: تعذّر التحقق من حدود الاستخدام." },
    { status: 503 },
  );
}

export function rateLimitedResponse(
  retryAfterSec: number,
  message?: string,
): NextResponse {
  return NextResponse.json(
    {
      type: "error",
      message:
        message ??
        `تجاوزت الحد المسموح. حاول مجدداً بعد ${retryAfterSec} ثانية.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}
