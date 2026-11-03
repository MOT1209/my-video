import { timingSafeEqual } from "node:crypto";

/** مقارنة بزمن ثابت كي لا يتسرّب السر عبر زمن الرد. */
export function secretMatches(received: string | null, expected: string): boolean {
  if (received === null) {
    return false;
  }
  const encoder = new TextEncoder();
  const a = encoder.encode(received);
  const b = encoder.encode(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * هل يحمل الطلب `Authorization: Bearer <CRON_SECRET>` الصحيح؟
 * يُعيد false إن لم يكن CRON_SECRET مضبوطاً (لا باب خلفي بسر فارغ).
 */
export function hasValidCronSecret(
  req: Request,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const expected = env.CRON_SECRET;
  if (!expected) {
    return false;
  }
  return secretMatches(req.headers.get("authorization"), `Bearer ${expected}`);
}
