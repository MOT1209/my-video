import { expect, test } from "bun:test";
import {
  installUpstashMocks,
  resetUpstashMockState,
  upstashMockState,
} from "./upstash-test-mocks";
import { resetUpstashRedisForTests } from "./upstash-redis";

const RENDER_LOCK_TTL_SEC = 600;

// المحاكاة قبل أي استيراد ديناميكي للكود المُختبر
installUpstashMocks();

const {
  acquireRenderLock,
  releaseRenderLock,
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
    const lockTtlMs = RENDER_LOCK_TTL_SEC * 1000;
    const t0 = 50_000;
    const owner = await acquireRenderLock("l:k1", t0);
    expect(owner).toBeTruthy();
    // نفس اللقطة: مشغول
    expect(await acquireRenderLock("l:k1", t0 + 1)).toBeNull();
    // بعد انتهاء TTL يُستبدل المالك، وإطلاق القفل القديم لا يمسح القفل الجديد.
    const replacementOwner = await acquireRenderLock(
      "l:k1",
      t0 + lockTtlMs + 1,
    );
    expect(replacementOwner).toBeTruthy();
    await releaseRenderLock("l:k1", owner!);
    expect(
      await acquireRenderLock("l:k1", t0 + lockTtlMs + 2),
    ).toBeNull();
    await releaseRenderLock("l:k1", replacementOwner!);
    expect(
      await acquireRenderLock("l:k1", t0 + lockTtlMs + 3),
    ).toBeTruthy();
  } finally {
    restoreEnv();
  }
});

test("مفاتيح Upstash: SET NX يُستخدم فعلاً والرفض يمنع", async () => {
  try {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    resetUpstashMockState();
    resetUpstashRedisForTests();

    // نجاح الاستناد إلى القفل
    const owner = await acquireRenderLock("dl:k1");
    expect(owner).toBeTruthy();
    expect(upstashMockState.setCalls).toHaveLength(1);
    expect(upstashMockState.setCalls[0].key).toBe("dl:k1");
    expect(upstashMockState.setCalls[0].opts).toEqual({
      nx: true,
      ex: RENDER_LOCK_TTL_SEC,
    });

    // الـ Redis يرفض (قفل مشغول):يجب أن يكون القفل مشغولاً
    upstashMockState.setResult = null;
    upstashMockState.setCalls = [];
    expect(await acquireRenderLock("dl:k2")).toBeNull();
    expect(upstashMockState.setCalls).toHaveLength(1);

    // التحرير يحذف القفل فقط إذا ظل مملوكاً لهذه العملية.
    const evalCallsBefore = upstashMockState.evalCalls.length;
    await releaseRenderLock("dl:k1", owner!);
    expect(upstashMockState.evalCalls).toHaveLength(evalCallsBefore + 1);
    expect(upstashMockState.evalCalls.at(-1)?.keys).toEqual(["dl:k1"]);
    expect(upstashMockState.evalCalls.at(-1)?.args).toEqual([owner!]);
    expect(upstashMockState.evalCalls.at(-1)?.script).toContain('redis.call("get", KEYS[1]) == ARGV[1]');
    upstashMockState.evalResult = 0;
    await releaseRenderLock("dl:k1", owner!);
    expect(upstashMockState.evalCalls).toHaveLength(evalCallsBefore + 2);
    upstashMockState.setResult = "OK";
    expect(await acquireRenderLock("dl:k2")).toBeTruthy();
  } finally {
    restoreEnv();
  }
});

test("تحرير قفل Redis يحافظ على قفل التطوير عند تعذر أمر الحذف", async () => {
  ENV_KEYS.forEach((key) => { process.env[key] = "https://fake.upstash.io"; });
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  resetUpstashMockState();
  resetUpstashRedisForTests();
  const savedNodeEnv = process.env.NODE_ENV;
  Object.defineProperty(process.env, "NODE_ENV", { value: "development", configurable: true, writable: true, enumerable: true });
  try {
    const t0 = Date.now();
    upstashMockState.throwError = new Error("Redis set unavailable");
    const owner = await acquireRenderLock("dev:redis-fallback", t0);
    expect(owner).toBeTruthy();
    upstashMockState.throwError = new Error("Redis delete unavailable");
    await expect(releaseRenderLock("dev:redis-fallback", owner!)).rejects.toThrow("Redis delete unavailable");
    upstashMockState.throwError = null;
    resetUpstashRedisForTests();
    ENV_KEYS.forEach((key) => delete process.env[key]);
    expect(await acquireRenderLock("dev:redis-fallback", t0 + 1)).toBeNull();
  } finally {
    Object.defineProperty(process.env, "NODE_ENV", { value: savedNodeEnv, configurable: true, writable: true, enumerable: true });
    restoreEnv();
  }
});

test("تحرير قفل Redis لا يحذف قفلاً لا يملكه الطلب", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  resetUpstashMockState();
  resetUpstashRedisForTests();
  try {
    const owner = await acquireRenderLock("redis:expired");
    expect(owner).toBeTruthy();
    upstashMockState.evalResult = 0;
    await releaseRenderLock("redis:expired", owner!);
    expect(upstashMockState.evalCalls).toHaveLength(1);
  } finally {
    restoreEnv();
  }
});

test("غياب Upstash أو تعطله في الإنتاج يرفض أخذ القفل", async () => {
  const savedNodeEnv = process.env.NODE_ENV;
  Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true, writable: true, enumerable: true });
  try {
    ENV_KEYS.forEach((key) => delete process.env[key]);
    resetUpstashRedisForTests();
    await expect(acquireRenderLock("production:no-redis")).rejects.toThrow("render_lock_unavailable");

    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    resetUpstashRedisForTests();
    upstashMockState.throwError = new Error("timeout");
    await expect(acquireRenderLock("production:error")).rejects.toThrow("timeout");
  } finally {
    Object.defineProperty(process.env, "NODE_ENV", { value: savedNodeEnv, configurable: true, writable: true, enumerable: true });
    restoreEnv();
  }
});

test("خطأ Upstash: سقوط شفاف إلى الذاكرة المحلية خارج الإنتاج", async () => {
  try {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    resetUpstashMockState();
    resetUpstashRedisForTests();
    upstashMockState.throwError = new Error("timeout");
    expect(await acquireRenderLock("err:k1")).toBeTruthy();
  } finally {
    restoreEnv();
  }
});
