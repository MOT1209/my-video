import Stripe from "stripe";
import { findCreditPack, type CreditPack } from "./credits";

/**
 * طبقة Stripe (سيرفر فقط — لا تُستورد من مكوّن عميل أبداً).
 * بلا STRIPE_SECRET_KEY: `getStripe()` يُعيد null فتبقى الفوترة معطّلة
 * بينما يعمل التطبيق كاملاً.
 */

let cached: Stripe | null | undefined;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe | null {
  if (cached === undefined) {
    const key = process.env.STRIPE_SECRET_KEY;
    cached = key ? new Stripe(key) : null;
  }
  return cached;
}

/** للاختبار فقط — يُفرش الكاش كي يُعاد البناء بعد تغيير المفاتيح. */
export function resetStripeForTests(): void {
  cached = undefined;
}

/** أقل شكل من حدث Stripe نحتاجه — يجعل الخريطة قابلة للاختبار بلا شبكة. */
export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export type GrantReason =
  | "granted"
  | "ignored-type"
  | "unpaid"
  | "missing-user"
  | "invalid-credits";

export interface CreditGrantDecision {
  /** هل نُطبّق التلقيت؟ */
  grant: boolean;
  reason: GrantReason;
  /** معرّف Clerk المُرفق في metadata (يُحوَّل لصف user لاحقاً). */
  clerkId: string | null;
  credits: number;
  packId: string | null;
}

/**
 * خريطة نقية: حدث Stripe → قرار تلقيت الكريدت.
 * تعتمد حصراً على metadata التي كتبناها نحن عند إنشاء جلسة الدفع،
 * وتتحقق من تطابق عدد الكريدتات مع الحزمة المُعلنة (حراسة ضد أخطاء
 * برمجية من جهتنا، لا ضد مستخدم لأن الويب هوك موقّع من Stripe).
 */
export function creditsFromStripeEvent(event: StripeEventLike): CreditGrantDecision {
  const base: CreditGrantDecision = {
    grant: false,
    reason: "ignored-type",
    clerkId: null,
    credits: 0,
    packId: null,
  };

  if (event.type !== "checkout.session.completed") {
    return base;
  }

  const object = event.data.object;
  const paymentStatus = typeof object.payment_status === "string" ? object.payment_status : null;
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    return { ...base, reason: "unpaid" };
  }

  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const clerkId = typeof metadata.clerkId === "string" && metadata.clerkId ? metadata.clerkId : null;
  if (!clerkId) {
    return { ...base, reason: "missing-user" };
  }

  const credits = Number(metadata.credits);
  const packId = typeof metadata.packId === "string" ? metadata.packId : null;
  if (!Number.isInteger(credits) || credits <= 0) {
    return { ...base, reason: "invalid-credits", clerkId, packId };
  }

  // حزمة مُعلنة → يجب أن يطابق عدد كريدتاتها (كشف خطأ تسعير/برمجة)
  if (packId) {
    const pack = findCreditPack(packId);
    if (!pack || pack.credits !== credits) {
      return { ...base, reason: "invalid-credits", clerkId, packId };
    }
  }

  return { grant: true, reason: "granted", clerkId, credits, packId };
}

/**
 * تحويل حدث Stripe الحقيقي إلى الشكل الذي تفهمه الخريطة النقية.
 * حصرنا الموضع هنا كي لا تتسرّب أنواع Stripe إلى المنطق القابل للاختبار.
 */
export function toStripeEventLike(event: Stripe.Event): StripeEventLike {
  return {
    id: event.id,
    type: event.type,
    data: { object: (event.data?.object ?? {}) as unknown as Record<string, unknown> },
  };
}

/** معلمات Stripe Checkout لحزمة كريدت — دالة نقية قابلة للاختبار. */
export function checkoutParamsForPack(pack: CreditPack, args: { clerkId: string; origin: string }) {
  return {
    mode: "payment" as const,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: { name: `كريدت تصيير — ${pack.label}` },
        },
      },
    ],
    // metadata يُنسخ إلى الـ Checkout Session — منه يعرف الويب هوك من نُلقّت له
    metadata: { clerkId: args.clerkId, packId: pack.id, credits: String(pack.credits) },
    success_url: `${args.origin}/?billing=success`,
    cancel_url: `${args.origin}/?billing=cancel`,
  };
}
