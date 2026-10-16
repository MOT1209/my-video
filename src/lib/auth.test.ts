import { expect, test } from "bun:test";
import { getRequestUser, isAuthConfigured, LOCAL_USER_ID } from "./auth";

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
