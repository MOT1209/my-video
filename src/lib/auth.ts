import { NextResponse } from "next/server";

/**
 * طبقة الهوية فوق Clerk:
 * - مفاتيح Clerk موجودة → المصادقة فعّالة: كل مسار محمي يرفض غير المسجّل.
 * - لا مفاتيح (تطوير محلي) → وضع محلي بمعرّف ثابت: يبقى التطبيق قابلاً
 *   للاستعمال بلا حساب، ويظل الكريدت غير مفروض (نفس سلوك ما قبل المرحلة 4).
 *
 * قرار مقصود: غياب المفاتيح لا يُعطّل التطبيق ولا يُسقطه بـ 500 — فقط
 * يرفع ميزات الحساب عن الطريق.
 */

export interface RequestUser {
  /** معرّف Clerk، أو معرّف الجلسة المحلية في وضع بلا مفاتيح. */
  clerkId: string;
  email: string | null;
  /** هل الطلب مصادَق عليه فعلياً؟ false في الوضع المحلي. */
  authenticated: boolean;
}

/** معرّف الجلسة المحلية — صف واحد ثابت في قاعدة البيانات عند التطوير. */
export const LOCAL_USER_ID = "local-dev-user";

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
}

/** بيانات المستخدم من Clerk — يُستدعى فقط عند وجود المفاتيح. */
async function readClerkUser(): Promise<RequestUser | null> {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return null;
  }
  const claims = (sessionClaims ?? {}) as Record<string, unknown>;
  const email = typeof claims.email === "string" ? claims.email : null;
  return { clerkId: userId, email, authenticated: true };
}

/**
 * المستخدم الحالي للطلب.
 * - مفاتيح موجودة وغير مسجّل → null (المسار يرد 401).
 * - بلا مفاتيح → مستخدم محلي (المسار يعمل كالسابق).
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  if (!isAuthConfigured()) {
    return { clerkId: LOCAL_USER_ID, email: null, authenticated: false };
  }
  return readClerkUser();
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { type: "error", message: "سجّل الدخول للمتابعة." },
    { status: 401 },
  );
}

/** رد واضح عند طلب ميزة تحتاج قاعدة بيانات غير مهيأة. */
export function databaseNotConfiguredResponse(): NextResponse {
  return NextResponse.json(
    {
      type: "error",
      message:
        "ميزة الحساب تحتاج قاعدة بيانات: أضف DATABASE_URL (Neon) ثم أعد المحاولة.",
    },
    { status: 503 },
  );
}
