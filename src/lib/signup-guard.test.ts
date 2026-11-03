import { describe, expect, test } from "bun:test";
import { FREE_SIGNUP_CREDITS } from "./credits";
import { createTestDb } from "./db/testing";
import { ensureUser } from "./db/repository";
import { getCredits } from "./db/repository";
import type { RateLimitVerdict } from "./rate-limit";
import {
  decideSignupCredits,
  freeSignupsPerIp,
  isDisposableEmail,
  signupCreditsResolver,
} from "./signup-guard";

const deny: () => Promise<RateLimitVerdict> = async () => ({ allowed: false, retryAfterSec: 3600 });

describe("isDisposableEmail", () => {
  test("يتعرف على النطاقات المؤقتة وفروعها وبحالات أحرف مختلفة", () => {
    expect(isDisposableEmail("bot@mailinator.com")).toBe(true);
    expect(isDisposableEmail("Bot@MAILINATOR.COM")).toBe(true);
    expect(isDisposableEmail("x@sub.mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@yopmail.fr")).toBe(true);
  });
  test("لا يحجب بريداً عادياً ولا قيماً فارغة أو غير صالحة", () => {
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
    expect(isDisposableEmail("user@company.org")).toBe(false);
    // نطاق يحتوي اسماً مؤقتاً كجزء من اسمه فقط
    expect(isDisposableEmail("user@notmailinator.com")).toBe(false);
    expect(isDisposableEmail(null)).toBe(false);
    expect(isDisposableEmail("")).toBe(false);
    expect(isDisposableEmail("no-at-sign")).toBe(false);
  });
});

describe("decideSignupCredits", () => {
  test("بريد عادي وIP ضمن الحد ⇒ كريدت مجاني كامل", async () => {
    const calls: Array<[string, number]> = [];
    const decision = await decideSignupCredits("user@gmail.com", {
      ip: "203.0.113.9",
      perIpLimit: 3,
      limit: async (key, limit) => {
        calls.push([key, limit]);
        return { allowed: true, retryAfterSec: 0 };
      },
    });
    expect(decision).toEqual({ credits: FREE_SIGNUP_CREDITS, reason: "granted" });
    expect(calls).toEqual([["signup-credits:203.0.113.9", 3]]);
  });

  test("بريد مؤقت ⇒ صفر، ولا يستهلك حصة الـ IP", async () => {
    let called = false;
    const decision = await decideSignupCredits("bot@mailinator.com", {
      ip: "203.0.113.9",
      limit: async () => {
        called = true;
        return { allowed: true, retryAfterSec: 0 };
      },
    });
    expect(decision).toEqual({ credits: 0, reason: "disposable-email" });
    expect(called).toBe(false);
  });

  test("تجاوز حد الـ IP ⇒ صفر", async () => {
    expect(
      await decideSignupCredits("user@gmail.com", { ip: "203.0.113.9", limit: deny }),
    ).toEqual({ credits: 0, reason: "ip-limit" });
  });

  test("تعذّر المحدِّد أو خطؤه ⇒ صفر (يفشل مغلقاً)", async () => {
    expect(
      await decideSignupCredits("user@gmail.com", {
        ip: "203.0.113.9",
        limit: async () => ({ allowed: false, retryAfterSec: 60, unavailable: true }),
      }),
    ).toEqual({ credits: 0, reason: "limiter-unavailable" });
    const originalError = console.error;
    console.error = () => {};
    try {
      expect(
        await decideSignupCredits("user@gmail.com", {
          ip: "203.0.113.9",
          limit: async () => {
            throw new Error("redis down");
          },
        }),
      ).toEqual({ credits: 0, reason: "limiter-unavailable" });
    } finally {
      console.error = originalError;
    }
  });

  test("بلا IP (خارج سياق طلب) ⇒ لا حد بالـ IP", async () => {
    const decision = await decideSignupCredits("user@gmail.com", { ip: null, limit: deny });
    expect(decision.credits).toBe(FREE_SIGNUP_CREDITS);
    const unknown = await decideSignupCredits("user@gmail.com", { ip: "unknown", limit: deny });
    expect(unknown.credits).toBe(FREE_SIGNUP_CREDITS);
  });
});

describe("freeSignupsPerIp", () => {
  test("افتراضي 3 وقابل للضبط، والقيم التالفة تُتجاهل", () => {
    expect(freeSignupsPerIp({})).toBe(3);
    expect(freeSignupsPerIp({ SIGNUP_FREE_PER_IP_PER_DAY: "10" })).toBe(10);
    expect(freeSignupsPerIp({ SIGNUP_FREE_PER_IP_PER_DAY: "0" })).toBe(0);
    expect(freeSignupsPerIp({ SIGNUP_FREE_PER_IP_PER_DAY: "abc" })).toBe(3);
    expect(freeSignupsPerIp({ SIGNUP_FREE_PER_IP_PER_DAY: "-5" })).toBe(3);
  });
});

describe("ensureUser مع مقرِّر الكريدت (على Postgres حقيقي)", () => {
  test("يُنفَّذ المقرِّر للحساب الجديد فقط، والرصيد يعتمد قراره", async () => {
    const { db } = await createTestDb();
    let calls = 0;
    const resolver = (credits: number) => async () => {
      calls += 1;
      return credits;
    };

    const bot = await ensureUser(db, { clerkId: "bot-1", signupCredits: resolver(0) });
    expect(calls).toBe(1);
    expect(await getCredits(db, bot.id)).toBe(0);

    // الطلب التالي لنفس الحساب: لا يُنفَّذ المقرِّر ولا يتغيّر الرصيد
    const again = await ensureUser(db, { clerkId: "bot-1", signupCredits: resolver(99) });
    expect(calls).toBe(1);
    expect(again.id).toBe(bot.id);
    expect(await getCredits(db, bot.id)).toBe(0);

    const human = await ensureUser(db, {
      clerkId: "human-1",
      signupCredits: resolver(FREE_SIGNUP_CREDITS),
    });
    expect(calls).toBe(2);
    expect(await getCredits(db, human.id)).toBe(FREE_SIGNUP_CREDITS);
  });

  test("بلا مقرِّر: الافتراضي كما كان (كريدت الترحيب الكامل) — مسار الويب هوك", async () => {
    const { db } = await createTestDb();
    const user = await ensureUser(db, { clerkId: "paid-1" });
    expect(await getCredits(db, user.id)).toBe(FREE_SIGNUP_CREDITS);
  });

  test("مقرِّر طلب حقيقي: بريد مؤقت ⇒ حساب بلا كريدت مجاني", async () => {
    const { db } = await createTestDb();
    const bot = await ensureUser(db, {
      clerkId: "bot-2",
      email: "x@mailinator.com",
      signupCredits: signupCreditsResolver("x@mailinator.com"),
    });
    expect(await getCredits(db, bot.id)).toBe(0);
  });
});
