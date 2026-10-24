import { expect, test } from "bun:test";
import {
  allowAnonymousPaidRoutes,
  getRequestUser,
  guardPaidRoute,
  isAuthConfigured,
  LOCAL_USER_ID,
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

test("مصادقة Clerk تعيد 503 عند تعذّر التحقق، لا استثناءً غير معالج", async () => {
  const savedNodeEnv = process.env.NODE_ENV;
  Object.defineProperty(process.env, "NODE_ENV", {
    value: "production",
    configurable: true,
    writable: true,
    enumerable: true,
  });
  try {
    await withEnv(
      {
        CLERK_SECRET_KEY: "sk_test_1",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_1",
      },
      async () => {
        const result = await guardPaidRoute();
        expect("response" in result).toBe(true);
        if ("response" in result) {
          expect(result.response.status).toBe(503);
        }
      },
    );
  } finally {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: savedNodeEnv,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  }
});

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

test("تحذير الإنتاج يظهر مرة واحدة فقط عند السماح بالمسارات المكلفة بلا Clerk", async () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedAllow = process.env.ALLOW_ANONYMOUS_PAID_ROUTES;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  const setNodeEnv = (value: string | undefined) => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  };
  console.warn = (message?: unknown) => warnings.push(String(message));
  try {
    setNodeEnv("production");
    await withEnv({}, async () => {
      delete process.env.ALLOW_ANONYMOUS_PAID_ROUTES;
      warnIfUnauthenticatedProduction();
      expect(warnings).toHaveLength(0);
      process.env.ALLOW_ANONYMOUS_PAID_ROUTES = "true";
      warnIfUnauthenticatedProduction();
      warnIfUnauthenticatedProduction();
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("ALLOW_ANONYMOUS_PAID_ROUTES");
  } finally {
    console.warn = originalWarn;
    setNodeEnv(savedNodeEnv);
    if (savedAllow === undefined) {
      delete process.env.ALLOW_ANONYMOUS_PAID_ROUTES;
    } else {
      process.env.ALLOW_ANONYMOUS_PAID_ROUTES = savedAllow;
    }
  }
});

test("بلا مفاتيح: الوضع المحلي محفوظ في التطوير لكنه مرفوض في الإنتاج", async () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const setNodeEnv = (value: string | undefined) => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  };
  try {
    setNodeEnv("development");
    await withEnv({}, async () => {
      expect(await getRequestUser()).toEqual({
        clerkId: LOCAL_USER_ID,
        email: null,
        authenticated: false,
      });
    });

    setNodeEnv("production");
    await withEnv({}, async () => {
      expect(await getRequestUser()).toBeNull();
    });
  } finally {
    setNodeEnv(savedNodeEnv);
  }
});

test("الإنتاج بلا Clerk: المسارات المكلفة تُغلق افتراضياً وتُفتح بالمتغير الصريح فقط", async () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedAllow = process.env.ALLOW_ANONYMOUS_PAID_ROUTES;
  const setNodeEnv = (value: string | undefined) => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  };
  try {
    await withEnv({}, async () => {
      setNodeEnv("production");
      delete process.env.ALLOW_ANONYMOUS_PAID_ROUTES;
      expect(allowAnonymousPaidRoutes()).toBe(false);
      const closed = await guardPaidRoute();
      expect("response" in closed).toBe(true);
      if ("response" in closed) {
        expect(closed.response.status).toBe(503);
      }

      process.env.ALLOW_ANONYMOUS_PAID_ROUTES = "true";
      expect(allowAnonymousPaidRoutes()).toBe(true);
      const open = await guardPaidRoute();
      expect("user" in open && open.user.clerkId).toBe(LOCAL_USER_ID);

      // التطوير المحلي يبقى مفتوحاً بلا متغير
      delete process.env.ALLOW_ANONYMOUS_PAID_ROUTES;
      setNodeEnv("development");
      expect(allowAnonymousPaidRoutes()).toBe(true);
    });
  } finally {
    setNodeEnv(savedNodeEnv);
    if (savedAllow === undefined) {
      delete process.env.ALLOW_ANONYMOUS_PAID_ROUTES;
    } else {
      process.env.ALLOW_ANONYMOUS_PAID_ROUTES = savedAllow;
    }
  }
});
