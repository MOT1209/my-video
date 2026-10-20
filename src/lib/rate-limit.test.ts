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
  checkRateLimit,
  inMemoryCheckRateLimit,
} = await import("./rate-limit");

const ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;
const savedEnv = ENV_KEYS.map((k) => process.env[k]);

function setUpstashEnv(): void {
  resetUpstashMockState();
  resetUpstashRedisForTests();
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
}

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

test("بلا مفاتيح Upstash: سقوط الذاكرة المحلية + بلا اتصال Redis", async () => {
  // الحالة المحاكاة مشتركة بين الملفات (ترتيبها يتغير بين التشغيلات) — نبدأ نظيفين
  resetUpstashMockState();
  ENV_KEYS.forEach((k) => delete process.env[k]);
  resetUpstashRedisForTests();
  try {
    const v = await checkRateLimit("mem:mixed-path", 2, 1000);
    expect(v.allowed).toBe(true);
    expect(upstashMockState.constructorCalls).toHaveLength(0);
  } finally {
    restoreEnv();
  }
});

test("inMemoryCheckRateLimit: نافذة ثابتة تحترم الحد وتتجدد", () => {
  const t0 = 10_000;
  expect(inMemoryCheckRateLimit("k1", 2, 5_000, t0).allowed).toBe(true);
  expect(inMemoryCheckRateLimit("k1", 2, 5_000, t0 + 1).allowed).toBe(true);
  const blocked = inMemoryCheckRateLimit("k1", 2, 5_000, t0 + 2);
  expect(blocked.allowed).toBe(false);
  expect(blocked.retryAfterSec).toBeGreaterThan(0);
  expect(inMemoryCheckRateLimit("k1", 2, 5_000, t0 + 6_000).allowed).toBe(true);
});

test("مفاتيح Upstash: المسار الموزّع يمر فعلاً عبر Ratelimit", async () => {
  setUpstashEnv();
  try {
    upstashMockState.limitResponse = { success: true, reset: 0 };
    const ok = await checkRateLimit("shared:new-ok", 5, 60_000);
    expect(ok.allowed).toBe(true);
    expect(ok.retryAfterSec).toBe(0);
    // الدليل: خزّن عميل Redis بُني بمفاتيح البيئة والنافذة ثابتة صحيحة
    expect(upstashMockState.constructorCalls.length).toBeGreaterThan(0);
    expect(upstashMockState.constructorCalls[0]).toEqual({
      url: "https://fake.upstash.io",
      token: "tok",
    });
    expect(upstashMockState.fixedWindowCalls[0]).toEqual({
      limit: 5,
      window: "60 s",
    });

    // محظور: reset طابع زمني لاحق — retryAfterSec من الفرق
    upstashMockState.limitResponse = {
      success: false,
      reset: Date.now() + 1_800_000,
    };
    const blocked = await checkRateLimit("shared:new-blocked", 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(1_700);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(1_800);
  } finally {
    restoreEnv();
  }
});

test("خطأ Upstash: سقوط شفاف إلى الذاكرة المحلية (لا رمي)", async () => {
  setUpstashEnv();
  try {
    resetUpstashRedisForTests();
    upstashMockState.throwError = new Error("network down");
    const v = await checkRateLimit("fallback:boom", 10, 60_000);
    expect(v.allowed).toBe(true);
  } finally {
    upstashMockState.throwError = null;
    restoreEnv();
  }
});

/** NODE_ENV للقراءة فقط في أنواع Next — نغيّره بالخاصية كما في auth.test. */
async function inProduction(
  extraEnv: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedAllow = process.env.RATE_LIMIT_ALLOW_IN_MEMORY;
  const setNodeEnv = (value: string | undefined) =>
    Object.defineProperty(process.env, "NODE_ENV", {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  try {
    setNodeEnv("production");
    for (const [k, v] of Object.entries(extraEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await fn();
  } finally {
    setNodeEnv(savedNodeEnv);
    if (savedAllow === undefined) delete process.env.RATE_LIMIT_ALLOW_IN_MEMORY;
    else process.env.RATE_LIMIT_ALLOW_IN_MEMORY = savedAllow;
    restoreEnv();
  }
}

test("الإنتاج بلا Upstash: المسارات المكلفة تُغلق (503) بدل عدّاد الذاكرة المجزّأ", async () => {
  const { rateLimitRejection } = await import("./rate-limit");
  await inProduction({ RATE_LIMIT_ALLOW_IN_MEMORY: undefined }, async () => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
    resetUpstashRedisForTests();
    const verdict = await checkRateLimit("prod:no-upstash", 100, 1000);
    expect(verdict).toMatchObject({ allowed: false, unavailable: true });
    const res = rateLimitRejection(verdict);
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});

test("الإنتاج مع تعطّل Upstash: رفض مغلق لا سقوط صامت للذاكرة", async () => {
  await inProduction({ RATE_LIMIT_ALLOW_IN_MEMORY: undefined }, async () => {
    setUpstashEnv();
    upstashMockState.throwError = new Error("ECONNRESET");
    const verdict = await checkRateLimit("prod:upstash-down", 100, 1000);
    expect(verdict).toMatchObject({ allowed: false, unavailable: true });
  });
});

test("الإنتاج مع فتح صريح RATE_LIMIT_ALLOW_IN_MEMORY=true: عدّاد الذاكرة يعمل", async () => {
  const { rateLimitRejection } = await import("./rate-limit");
  await inProduction({ RATE_LIMIT_ALLOW_IN_MEMORY: "true" }, async () => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
    resetUpstashRedisForTests();
    expect((await checkRateLimit("prod:opt-in", 1, 60_000)).allowed).toBe(true);
    const blocked = await checkRateLimit("prod:opt-in", 1, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.unavailable).toBeUndefined();
    expect(rateLimitRejection(blocked).status).toBe(429);
  });
});
