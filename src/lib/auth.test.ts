import { expect, test } from "bun:test";
import {
  getRequestUser,
  isAuthConfigured,
  LOCAL_USER_ID,
  resetAuthModeWarningForTests,
  warnIfUnauthenticatedProduction,
} from "./auth";

/**
 * الاختبار يغطّي المسار الآمن فقط: الوضع المحلي (بلا مفاتيح) لا يلمس
 * Clerk إطلاقاً. مسار Clerk نفسه يحتاج طلب Next حقيقياً — موثّق كغير
 * مُغطّى بالاختبارات الآلية.
 */

const KEYS = ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] as const;

/** يقود العملية بمفاتيح بيئة محددة ثم يُعيد الأصل مهما حدث. */
async function withEnv(
  values: Partial<Record<(typeof KEYS)[number], string>>,
  fn: () => Promise<void>,
): Promise<void> {
  const saved = KEYS.map((key) => [key, process.env[key]] as const);
  for (const key of KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  try {
    await fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("المصادقة تُعدّ مهيأة فقط بوجود المفتاحَين معاً", async () => {
  await withEnv({}, async () => expect(isAuthConfigured()).toBe(false));
  await withEnv({ CLERK_SECRET_KEY: "sk_test_1" }, async () =>
    expect(isAuthConfigured()).toBe(false),
  );
  await withEnv({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_1" }, async () =>
    expect(isAuthConfigured()).toBe(false),
  );
  await withEnv(
    { CLERK_SECRET_KEY: "sk_test_1", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_1" },
    async () => expect(isAuthConfigured()).toBe(true),
  );
});

test("بلا مفاتيح: الطلب يُعاد كمستخدم محلي غير مصادَق بدل الفشل", async () => {
  await withEnv({}, async () => {
    const user = await getRequestUser();
    expect(user).toEqual({
      clerkId: LOCAL_USER_ID,
      email: null,
      authenticated: false,
    });
  });
});

test("التحذير يُطلق مرة واحدة في الإنتاج بلا مفاتيح فقط", async () => {
  const savedNodeEnv = process.env.NODE_ENV;
  /** NODE_ENV للقراءة فقط في الأنواع — نغيّرها عبر إعادة التعريف. */
  const setNodeEnv = (value: string | undefined) => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  };
  const savedWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    // إنتاج بلا مفاتيح → تحذير واحد مهما تكرر الاستدعاء
    setNodeEnv("production");
    await withEnv({}, async () => {
      resetAuthModeWarningForTests();
      warnIfUnauthenticatedProduction();
      warnIfUnauthenticatedProduction();
      expect(calls.length).toBe(1);
      expect(String(calls[0][0])).toMatch(/بلا مصادقة/);
    });
    // غير الإنتاج → صمت تام
    setNodeEnv("test");
    await withEnv({}, async () => {
      resetAuthModeWarningForTests();
      warnIfUnauthenticatedProduction();
      expect(calls.length).toBe(1);
    });
    // مفاتيح موجودة → صمت حتى في الإنتاج
    setNodeEnv("production");
    await withEnv(
      {
        CLERK_SECRET_KEY: "sk_test_1",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_1",
      },
      async () => {
        resetAuthModeWarningForTests();
        warnIfUnauthenticatedProduction();
        expect(calls.length).toBe(1);
      },
    );
  } finally {
    console.warn = savedWarn;
    setNodeEnv(savedNodeEnv);
    resetAuthModeWarningForTests();
  }
});
