import { expect, test } from "bun:test";
import {
  installUpstashMocks,
  resetUpstashMockState,
  upstashMockState,
} from "./upstash-test-mocks";
import { resetUpstashRedisForTests } from "./upstash-redis";

// المحاكاة قبل أي استيراد ديناميكي للكود المُختبر
installUpstashMocks();

const {
  acquireRenderLock,
  releaseRenderLock,
  RENDER_LOCK_TTL_SEC,
} = await import("./render-lock");

const ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NODE_ENV",
  "RATE_LIMIT_ALLOW_IN_MEMORY",
] as const;
const savedEnv = ENV_KEYS.map((k) => process.env[k]);

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  Object.defineProperty(process.env, key, {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
  if (value === undefined) delete process.env[key];
}

function restoreEnv(): void {
  ENV_KEYS.forEach((k, i) => setEnv(k, savedEnv[i]));
  resetUpstashRedisForTests();
}

function useUpstash(): void {
  setEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
  setEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
  resetUpstashMockState();
  resetUpstashRedisForTests();
}

function tokenOf(result: Awaited<ReturnType<typeof acquireRenderLock>>): string {
  if (!result.acquired) throw new Error(`lock not acquired: ${result.reason}`);
  return result.token;
}

test("بلا مفاتيح: خريطة محلية (القفل + الإفلات + انتهاء TTL)", async () => {
  resetUpstashMockState();
  setEnv("UPSTASH_REDIS_REST_URL", undefined);
  setEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  resetUpstashRedisForTests();
  try {
    const t0 = 50_000;
    const first = tokenOf(await acquireRenderLock("l:k1", t0));
    // نفس اللقطة: مشغول
    expect(await acquireRenderLock("l:k1", t0 + 1)).toEqual({
      acquired: false,
      reason: "held",
    });
    // بعد انتهاء TTL يعاد الفتح لمالك جديد
    const second = tokenOf(
      await acquireRenderLock("l:k1", t0 + RENDER_LOCK_TTL_SEC * 1000 + 1),
    );
    // المالك القديم (انتهى قفله) لا يحرّر قفل المالك الجديد
    await releaseRenderLock("l:k1", first);
    expect((await acquireRenderLock("l:k1", t0 + RENDER_LOCK_TTL_SEC * 1000 + 2)).acquired).toBe(false);
    // المالك الحالي يحرّر فيفتح فوراً
    await releaseRenderLock("l:k1", second);
    expect((await acquireRenderLock("l:k1", t0 + 1)).acquired).toBe(true);
  } finally {
    restoreEnv();
  }
});

test("مفاتيح Upstash: SET NX برمز مالك، والتحرير مقارنة-ثم-حذف بنفس الرمز", async () => {
  try {
    useUpstash();
    const token = tokenOf(await acquireRenderLock("dl:k1"));
    expect(upstashMockState.setCalls).toHaveLength(1);
    expect(upstashMockState.setCalls[0].key).toBe("dl:k1");
    expect(upstashMockState.setCalls[0].opts).toEqual({
      nx: true,
      ex: RENDER_LOCK_TTL_SEC,
    });

    // الـ Redis يرفض (قفل مشغول)
    upstashMockState.setResult = null;
    expect(await acquireRenderLock("dl:k2")).toEqual({
      acquired: false,
      reason: "held",
    });

    // التحرير لا يحذف أعمى: يمرر رمز المالك لسكربت المقارنة
    await releaseRenderLock("dl:k1", token);
    expect(upstashMockState.delCalls).toEqual([]);
    expect(upstashMockState.evalCalls).toEqual([{ keys: ["dl:k1"], args: [token] }]);
  } finally {
    restoreEnv();
  }
});

test("خطأ Upstash خارج الإنتاج: سقوط شفاف إلى الذاكرة المحلية", async () => {
  try {
    useUpstash();
    setEnv("NODE_ENV", "test");
    upstashMockState.throwError = new Error("timeout");
    expect((await acquireRenderLock("err:k1")).acquired).toBe(true);
  } finally {
    restoreEnv();
  }
});

test("خطأ Upstash في الإنتاج: رفض مغلق (لا قفل محلي لا يحمي النسخ الأخرى)", async () => {
  try {
    useUpstash();
    setEnv("NODE_ENV", "production");
    setEnv("RATE_LIMIT_ALLOW_IN_MEMORY", undefined);
    upstashMockState.throwError = new Error("timeout");
    expect(await acquireRenderLock("err:k2")).toEqual({
      acquired: false,
      reason: "unavailable",
    });
    // الفتح الصريح يعيد السقوط المحلي
    setEnv("RATE_LIMIT_ALLOW_IN_MEMORY", "true");
    expect((await acquireRenderLock("err:k3")).acquired).toBe(true);
  } finally {
    restoreEnv();
  }
});
