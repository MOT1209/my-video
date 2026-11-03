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

/**
 * مهلة استدعاء Clerk (استيراد الوحدة أو auth() نفسه): تجاوزها يفشل
 * المسار إلى 503 سريعاً بدل تعليق الطلب عند بطء أو انقسام الشبكة.
 */
const CLERK_AUTH_TIMEOUT_MS = 5_000;

async function withClerkTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label}: exceeded ${CLERK_AUTH_TIMEOUT_MS}ms`)),
          CLERK_AUTH_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
}

/** بيانات المستخدم من Clerk — يُستدعى فقط عند وجود المفاتيح. */
async function readClerkUser(): Promise<RequestUser | null> {
  const { auth } = await withClerkTimeout(
    import("@clerk/nextjs/server"),
    "clerk module import",
  );
  const { userId, sessionClaims } = await withClerkTimeout(auth(), "clerk auth()");
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

/** ميزات الحساب (مشاريع/سجل/رصيد) في الإنتاج بلا Clerk: لا حساب مشترك. */
export function accountsDisabledResponse(): NextResponse {
  return NextResponse.json(
    {
      type: "error",
      message:
        "ميزات الحساب معطّلة حتى تُفعَّل المصادقة: أضف مفاتيح Clerk (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY و CLERK_SECRET_KEY).",
    },
    { status: 503 },
  );
}

/** رد واضح عند طلب ميزة تحتاج قاعدة بيانات غير مهيأة. */
/** رد واضح عند فشل التحقق من الهوية مؤقتاً (Clerk بطيء أو متعذر). */
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
  const user = await getRequestUser();
  if (!user) {
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
