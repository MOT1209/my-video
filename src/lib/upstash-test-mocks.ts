import { mock } from "bun:test";

/**
 * محاكاة مشتركة لِ ‏@upstash/redis و ‏@upstash/ratelimit لبُنى الحيّة
 * (تُستعمل من ‏rate-limit.test.ts و ‏render-lock.test.ts). بلا شبكة إطلاقاً:
 * كل السلوك يُضبط عبر كائن الحالة أدناه قبل/أثناء كل اختبار.
 */

export interface UpstashMockState {
  /** نتيجة `set` التالية: "OK" للنجاح، null للرفض (قفل مشغول). */
  setResult: "OK" | null;
  /** نتيجة `limit` التالية للمحدّد. */
  limitResponse: { success: boolean; reset: number };
  /** إن ضُبط: الخطأ التالي يُرفض من set/del/limit معاً (اختبار سقوط). */
  throwError: Error | null;
  constructorCalls: Array<{ url: string; token: string }>;
  setCalls: Array<{ key: string; opts: unknown }>;
  delCalls: string[];
  fixedWindowCalls: Array<{ limit: number; window: string }>;
}

export const upstashMockState: UpstashMockState = {
  setResult: "OK",
  limitResponse: { success: true, reset: 0 },
  throwError: null,
  constructorCalls: [],
  setCalls: [],
  delCalls: [],
  fixedWindowCalls: [],
};

/** يعيد الحالة لنقطة بداية نظيفة (ما بين الاختبارات). */
export function resetUpstashMockState(): void {
  upstashMockState.setResult = "OK";
  upstashMockState.limitResponse = { success: true, reset: 0 };
  upstashMockState.throwError = null;
  upstashMockState.constructorCalls = [];
  upstashMockState.setCalls = [];
  upstashMockState.delCalls = [];
  upstashMockState.fixedWindowCalls = [];
}

class FakeRedis {
  constructor(cfg: { url: string; token: string }) {
    upstashMockState.constructorCalls.push({
      url: cfg.url,
      token: cfg.token,
    });
  }

  set(key: string, _value: string, opts: unknown) {
    upstashMockState.setCalls.push({ key, opts });
    if (upstashMockState.throwError) {
      return Promise.reject(upstashMockState.throwError);
    }
    return Promise.resolve(upstashMockState.setResult);
  }

  del(key: string) {
    upstashMockState.delCalls.push(key);
    if (upstashMockState.throwError) {
      return Promise.reject(upstashMockState.throwError);
    }
    return Promise.resolve(1);
  }
}

class FakeRatelimit {
  private cfg: unknown;

  constructor(cfg: unknown) {
    this.cfg = cfg;
  }

  static fixedWindow(limit: number, window: string) {
    upstashMockState.fixedWindowCalls.push({ limit, window });
    return { limit, window };
  }

  limit(): Promise<{ success: boolean; reset: number }> {
    if (upstashMockState.throwError) {
      return Promise.reject(upstashMockState.throwError);
    }
    return Promise.resolve(upstashMockState.limitResponse);
  }

  get config(): unknown {
    return this.cfg;
  }
}

/** يُستدعى قبل أي استيراد ديناميكي للوحدات المُختبرة. */
export function installUpstashMocks(): void {
  mock.module("@upstash/redis", () => ({ Redis: FakeRedis as never }));
  mock.module("@upstash/ratelimit", () => ({
    Ratelimit: FakeRatelimit as never,
  }));
}
