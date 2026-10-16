import { z } from "zod";
import { getRequestUser, unauthorizedResponse } from "../../../../lib/auth";
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
  if (!stripe) {
    return apiError(
      "الفوترة غير مهيأة على الخادم: أضف STRIPE_SECRET_KEY ثم أعد المحاولة.",
      503,
    );
  }

  const user = await getRequestUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const parsed = CheckoutRequest.safeParse(await req.json().catch(() => null));
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
