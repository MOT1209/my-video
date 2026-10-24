import { z } from "zod";
import {
  authServiceUnavailableResponse,
  getRequestUser,
  unauthorizedResponse,
} from "../../../../lib/auth";
import { apiError, apiSuccess } from "../../../../helpers/api-response";
import { findCreditPack } from "../../../../lib/credits";
import { checkoutParamsForPack, getStripe } from "../../../../lib/stripe";

/**
 * إنشاء جلسة دفع لحزمة كريدت.
 * لا نحتاج قاعدة بيانات هنا: التلقيت يقع في الويب هوك (المصدر الموثوق)،
 * ومعرّف المستخدم يسافر في `metadata` الموقّعة من Stripe.
 */

const CheckoutRequest = z.object({
  packId: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const stripe = getStripe();
  let user;
  try {
    user = await getRequestUser();
  } catch (error) {
    console.error(
      "billing/checkout: Clerk request authentication failed",
      error instanceof Error ? error.name : "unknown",
    );
    return authServiceUnavailableResponse();
  }
  if (!user) {
    return unauthorizedResponse();
  }
  // الشراء يتطلب هوية حقيقية في الإنتاج: المستخدم المحلي المشترك
  // (بلا Clerk) سيضع كريدت مدفوعاً في حساب لا يملكه أحد.
  if (!user.authenticated && process.env.NODE_ENV === "production") {
    return unauthorizedResponse();
  }
  if (!stripe) {
    return apiError(
      "الفوترة غير مهيأة على الخادم: أضف STRIPE_SECRET_KEY ثم أعد المحاولة.",
      503,
    );
  }

  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return apiError("أرسل الطلب بصيغة application/json.", 415);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError("تعذّر قراءة JSON صالح.", 400);
  }
  const parsed = CheckoutRequest.safeParse(payload);
  if (!parsed.success) {
    return apiError("حزمة الكريدت غير محددة.", 400);
  }
  const pack = findCreditPack(parsed.data.packId);
  if (!pack) {
    return apiError("حزمة كريدت غير معروفة.", 404);
  }

  const origin =
    req.headers.get("origin") ?? new URL(req.url).origin;

  try {
    const session = await stripe.checkout.sessions.create(
      checkoutParamsForPack(pack, { clerkId: user.clerkId, origin }),
    );
    if (!session.url) {
      return apiError("لم يُرجع Stripe رابط دفع.", 502);
    }
    return apiSuccess({ url: session.url, packId: pack.id });
  } catch (err) {
    console.error("billing/checkout: فشل إنشاء جلسة الدفع", err);
    return apiError("تعذّر إنشاء جلسة الدفع. حاول لاحقاً.", 502);
  }
}
