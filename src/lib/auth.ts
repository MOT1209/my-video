import { NextResponse } from "next/server";

/**
 * طبقة الهوية فوق Clerk:
 * - مفاتيح Clerk موجودة → المصادقة فعّالة: كل مسار محمي يرفض غير المسجّل.
 * - لا مفاتيح خارج الإنتاج → وضع محلي بمعرّف ثابت للحفاظ على التطوير.
 * - الإنتاج بلا المفتاحين → لا مستخدم؛ كل عملية محمية أو مكلفة تُرفض.
 *
 * غياب الإعدادات في الإنتاج إعداد غير آمن، وليس سبباً للتحول إلى مستخدم محلي.
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

let productionAuthWarningLogged = false;

/** Warn once when production is deliberately using unauthenticated paid routes. */
export function warnIfUnauthenticatedProduction(): void {
  if (process.env.NODE_ENV === "production" && !isAuthConfigured()) {
    if (process.env.ALLOW_ANONYMOUS_PAID_ROUTES !== "true") {
      return;
    }
    if (!productionAuthWarningLogged) {
      productionAuthWarningLogged = true;
      console.warn(
        "Paid routes are enabled without Clerk authentication via ALLOW_ANONYMOUS_PAID_ROUTES.",
      );
    }
  }
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
 * - الإنتاج بلا مفاتيح → null (يفشل مغلقاً).
 * - خارج الإنتاج بلا مفاتيح → مستخدم محلي للتطوير.
 */
export async function getRequestUser(): Promise<RequestUser | null> {
  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }
    return { clerkId: LOCAL_USER_ID, email: null, authenticated: false };
  }
  return readClerkUser();
}

export function authServiceUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      type: "error",
      code: "AUTH_UNAVAILABLE",
      message: "تعذّرت خدمة المصادقة مؤقتاً. حاول لاحقاً.",
    },
    { status: 503 },
  );
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { type: "error", message: "سجّل الدخول للمتابعة." },
    { status: 401 },
  );
}

/** رد واضح عند طلب ميزة تحتاج قاعدة بيانات غير مهيأة. */
export function databaseUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      type: "error",
      message: "قاعدة البيانات غير متاحة مؤقتاً. حاول لاحقاً.",
    },
    { status: 503 },
  );
}

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
  let user: RequestUser | null;
  try {
    user = await getRequestUser();
  } catch (error) {
    console.error(
      "auth: Clerk request authentication failed",
      error instanceof Error ? error.name : "unknown",
    );
    return { response: authServiceUnavailableResponse() };
  }
  if (!user) {
    if (process.env.NODE_ENV === "production" && !isAuthConfigured()) {
      if (!allowAnonymousPaidRoutes()) {
        return { response: paidRoutesDisabledResponse() };
      }
      return {
        user: { clerkId: LOCAL_USER_ID, email: null, authenticated: false },
      };
    }
    return { response: unauthorizedResponse() };
  }
  if (!user.authenticated && !allowAnonymousPaidRoutes()) {
    return { response: paidRoutesDisabledResponse() };
  }
  return { user };
}

/**
 * رد موحّد حين تُطلب ميزة مدفوعة في الإنتاج وطبقة الفوترة غير مهيأة
 * (لا DATABASE_URL): نرفض بدل أن نُصيّر مجاناً بصمت. الاستثناء الوحيد
 * هو الفتح الصريح `ALLOW_ANONYMOUS_PAID_ROUTES=true` (أداة شخصية تقبل
 * الاستخدام غير المقاس عن علم).
 */
export function billingUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      type: "error",
      message:
        "التصيير معطّل مؤقتاً: طبقة الفوترة غير متاحة على الخادم (DATABASE_URL). حاول لاحقاً.",
    },
    { status: 503 },
  );
}
