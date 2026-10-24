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
 * - لا مفتاحَين (تطوير محلي غالباً) → نفس منطق النوافذ في الذاكرة المحلية
 *   (سلوك 1:1 مع القديم) كي لا يتوقف التطوير — لكنه يظل لكل نسخة على حدة.
 * - خطأ Upstash (شبكة مثلاً) → نجنّب للذاكرة المحلية ولا نُعطّل التصيير.
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

export interface RateLimitVerdict {
  allowed: boolean;
  retryAfterSec: number;
  /** true = الرفض سببه غياب/تعطّل المحدِّد الموزّع (503) لا تجاوز الحد (429). */
  unavailable?: boolean;
}

/**
 * هل يُقبل المحدِّد المحلي (لكل نسخة على حدة) بديلاً؟
 * - خارج الإنتاج: نعم دائماً (التطوير لا يتطلب Upstash).
 * - في الإنتاج: لا، إلا بفتح صريح `RATE_LIMIT_ALLOW_IN_MEMORY=true` —
 *   فالعدّاد في الذاكرة يتجزأ على نسخ serverless ولا يحمي الكلفة، ومساراتنا
 *   المحدودة كلها مكلفة (تصيير، LLM، صور، صوت، نسخ).
 */
export function inMemoryRateLimitAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.RATE_LIMIT_ALLOW_IN_MEMORY === "true"
  );
}

/** رفض مغلق عند تعذّر الحد الموزّع في الإنتاج — نعيد المحاولة بعد دقيقة. */
const DISTRIBUTED_LIMITER_UNAVAILABLE: RateLimitVerdict = {
  allowed: false,
  retryAfterSec: 60,
  unavailable: true,
};

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitVerdict> {
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
      if (!inMemoryRateLimitAllowed()) {
        console.error("rate-limit: فشل Upstash في الإنتاج — رفض مغلق", err);
        return DISTRIBUTED_LIMITER_UNAVAILABLE;
      }
      console.warn("rate-limit: فشل Upstash — سقوط محلي (ذاكرة)", err);
    }
  } else if (!inMemoryRateLimitAllowed()) {
    console.error(
      "rate-limit: Upstash غير مهيأ في الإنتاج — المسارات المكلفة مغلقة (أضف UPSTASH_REDIS_REST_URL/TOKEN).",
    );
    return DISTRIBUTED_LIMITER_UNAVAILABLE;
  }
  return inMemoryCheckRateLimit(key, limit, windowMs);
}

/** الرد المناسب لحكم رافض: 503 لتعذّر المحدِّد، 429 لتجاوز الحد. */
export function rateLimitRejection(verdict: RateLimitVerdict): NextResponse {
  if (verdict.unavailable) {
    return NextResponse.json(
      {
        type: "error",
        message: "الخدمة غير متاحة مؤقتاً (حماية الاستخدام غير مهيأة). حاول لاحقاً.",
      },
      { status: 503, headers: { "Retry-After": String(verdict.retryAfterSec) } },
    );
  }
  return rateLimitedResponse(verdict.retryAfterSec);
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
