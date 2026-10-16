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
] as const;
const savedEnv = ENV_KEYS.map((k) => process.env[k]);

function restoreEnv(): void {
  ENV_KEYS.forEach((k, i) => {
    const v = savedEnv[i];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  });
  resetUpstashRedisForTests();
}

test("بلا مفاتيح: خريطة محلية (القفل + الإفلات + انتهاء TTL)", async () => {
  resetUpstashMockState();
  ENV_KEYS.forEach((k) => delete process.env[k]);
  resetUpstashRedisForTests();
  try {
    const t0 = 50_000;
    expect(await acquireRenderLock("l:k1", t0)).toBe(true);
    // نفس اللقطة: مشغول
    expect(await acquireRenderLock("l:k1", t0 + 1)).toBe(false);
    // بعد انتهاء TTL يعاد الفتح
    expect(
      await acquireRenderLock("l:k1", t0 + RENDER_LOCK_TTL_SEC * 1000 + 1),
    ).toBe(true);
    // التحرير اليدوي يفتح فوراً
    await releaseRenderLock("l:k1");
    expect(await acquireRenderLock("l:k1", t0 + 1)).toBe(true);
  } finally {
    restoreEnv();
  }
});

test("مفاتيح Upstash: SET NX يُستخدم فعلاً، الرفض يمنع والتحرير يستدعي del", async () => {
  try {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    resetUpstashMockState();
    resetUpstashRedisForTests();

    // نجاح الاستناد إلى القفل
    expect(await acquireRenderLock("dl:k1")).toBe(true);
    expect(upstashMockState.setCalls).toHaveLength(1);
    expect(upstashMockState.setCalls[0].key).toBe("dl:k1");
    expect(upstashMockState.setCalls[0].opts).toEqual({
      nx: true,
      ex: RENDER_LOCK_TTL_SEC,
    });

    // الـ Redis يرفض (قفل مشغول):يجب أن يكون القفل مشغولاً
    upstashMockState.setResult = null;
    upstashMockState.setCalls = [];
    expect(await acquireRenderLock("dl:k2")).toBe(false);
    expect(upstashMockState.setCalls).toHaveLength(1);

    // التحرير يستدعي del وبعده يمكن الاستناد من جديد
    upstashMockState.delCalls = [];
    await releaseRenderLock("dl:k1");
    expect(upstashMockState.delCalls).toEqual(["dl:k1"]);
    upstashMockState.setResult = "OK";
    expect(await acquireRenderLock("dl:k2")).toBe(true);
  } finally {
    restoreEnv();
  }
});

test("خطأ Upstash: سقوط شفاف إلى الذاكرة المحلية", async () => {
  try {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    resetUpstashMockState();
    resetUpstashRedisForTests();
    upstashMockState.throwError = new Error("timeout");
    expect(await acquireRenderLock("err:k1")).toBe(true);
  } finally {
    restoreEnv();
  }
});
