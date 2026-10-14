import { NextResponse } from "next/server";

/**
 * حد المعدل (in-memory, نافذة ثابتة لكل IP).
 * يكفي كحماية أولية قبل النشر العام. ملاحظة: في بيئة serverless متعددة
 * النسخ لا تتشارك الذاكرة — عند التوسع انقل إلى Vercel KV / Upstash Redis
 * بنفس الواجهة (checkRateLimit).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
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

export function rateLimitedResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    {
      type: "error",
      message: `تجاوزت الحد المسموح. حاول مجدداً بعد ${retryAfterSec} ثانية.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}
