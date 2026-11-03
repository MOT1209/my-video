import { describe, expect, test } from "bun:test";
import { checkReadiness, isReady } from "./readiness";
import { hasValidCronSecret, secretMatches } from "./secret";

const ALL_REQUIRED = {
  BLOB_READ_WRITE_TOKEN: "x",
  DATABASE_URL: "x",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "x",
  CLERK_SECRET_KEY: "x",
  UPSTASH_REDIS_REST_URL: "x",
  UPSTASH_REDIS_REST_TOKEN: "x",
};

describe("checkReadiness", () => {
  test("بيئة فارغة: كل المطلوب ناقص وغير جاهز", () => {
    const checks = checkReadiness({});
    expect(checks.every((c) => !c.ok)).toBe(true);
    expect(isReady(checks)).toBe(false);
  });

  test("المطلوب مضبوط والاختياري ناقص ⇒ جاهز", () => {
    const checks = checkReadiness(ALL_REQUIRED);
    expect(isReady(checks)).toBe(true);
    expect(checks.filter((c) => c.required).every((c) => c.ok)).toBe(true);
    expect(checks.find((c) => c.id === "stripe")?.ok).toBe(false);
  });

  test("متغيرات مجموعة تحتاج كلها: نصف زوج Upstash لا يكفي", () => {
    const checks = checkReadiness({ ...ALL_REQUIRED, UPSTASH_REDIS_REST_TOKEN: "" });
    expect(checks.find((c) => c.id === "upstash")?.ok).toBe(false);
    expect(isReady(checks)).toBe(false);
  });

  test("لا تحتوي النتيجة قيماً، أسماء فقط", () => {
    const secret = "super-secret-value-123";
    const json = JSON.stringify(checkReadiness({ ...ALL_REQUIRED, CLERK_SECRET_KEY: secret }));
    expect(json).not.toContain(secret);
  });
});

describe("secret helpers", () => {
  test("secretMatches", () => {
    expect(secretMatches("abc", "abc")).toBe(true);
    expect(secretMatches("abd", "abc")).toBe(false);
    expect(secretMatches("abcd", "abc")).toBe(false);
    expect(secretMatches(null, "abc")).toBe(false);
  });

  test("hasValidCronSecret: لا باب خلفي بسر غير مضبوط أو فارغ", () => {
    const req = (auth?: string) =>
      new Request("http://localhost/x", { headers: auth ? { authorization: auth } : {} });
    expect(hasValidCronSecret(req("Bearer s3"), { CRON_SECRET: "s3" })).toBe(true);
    expect(hasValidCronSecret(req("Bearer nope"), { CRON_SECRET: "s3" })).toBe(false);
    expect(hasValidCronSecret(req(), { CRON_SECRET: "s3" })).toBe(false);
    expect(hasValidCronSecret(req("Bearer "), {})).toBe(false);
    expect(hasValidCronSecret(req("Bearer "), { CRON_SECRET: "" })).toBe(false);
  });
});
