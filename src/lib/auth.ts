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

let authModeWarned = false;

/**
 * تحذير مرة واحدة عندما يستقبل مسار مكلف طلباً غير مصادَق في الإنتاج:
 * يعني ذلك أن مفاتيح Clerk غائبة وأن التصيير مفتوح لأي زائر (خطر تكلفة).
 * في التطوير المحلي لا تحذير — الوضع المفتوح مقصود هناك.
 */
export function warnIfUnauthenticatedProduction(): void {
  if (authModeWarned) {
    return;
  }
  if (process.env.NODE_ENV === "production" && !isAuthConfigured()) {
    authModeWarned = true;
    console.warn(
      "auth: يعمل /api/render بلا مصادقة (مفاتيح Clerk غائبة) — التصيير مفتوح لأي زائر. أضف مفاتيح Clerk لحماية التكلفة.",
    );
  }
}

/** للاختبار فقط — يُصفّر علم التحذير لمرة واحدة. */
export function resetAuthModeWarningForTests(): void {
  authModeWarned = false;
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

/**
 * المسارات المكلفة (التصيير وتوليد السكربت والصور) في الإنتاج بلا Clerk:
 * تُغلق افتراضياً بدل أن تبقى مفتوحة لأي زائر، لأن حد المعدل في الذاكرة
 * لكل نسخة serverless على حدة ولا يحمي التكلفة. من يريد فتحها عمداً
 * (أداة شخصية مثلاً) يضبط ALLOW_ANONYMOUS_PAID_ROUTES=true.
 * في التطوير المحلي تبقى مفتوحة كما كانت.
 */
export function allowAnonymousPaidRoutes(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_ANONYMOUS_PAID_ROUTES === "true"
  );
}

export function paidRoutesDisabledResponse(): NextResponse {
  return NextResponse.json(
    {
      type: "error",
      message:
        "هذه الميزة معطّلة حتى تُفعَّل المصادقة: أضف مفاتيح Clerk، أو اضبط ALLOW_ANONYMOUS_PAID_ROUTES=true لفتحها عمداً.",
    },
    { status: 503 },
  );
}

/** بوابة موحّدة للمسارات المكلفة: مستخدم صالح أو ردّ جاهز للإرجاع. */
export async function guardPaidRoute(): Promise<
  { user: RequestUser } | { response: NextResponse }
> {
  const user = await getRequestUser();
  if (!user) {
    return { response: unauthorizedResponse() };
  }
  if (!user.authenticated && !allowAnonymousPaidRoutes()) {
    return { response: paidRoutesDisabledResponse() };
  }
  return { user };
}
