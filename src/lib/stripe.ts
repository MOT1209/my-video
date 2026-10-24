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
  /** معرّف جلسة الدفع (cs_...) — مفتاح منع التكرار الثاني بعد معرّف الحدث. */
  checkoutSessionId: string | null;
}

/**
 * أحداث الدفع التي تمنح الكريدت:
 * - `completed`: الدفع الفوري (بطاقة) — `payment_status = paid`.
 * - `async_payment_succeeded`: وسائل الدفع المؤجّلة (تحويل بنكي...) — تكتمل
 *   الجلسة أولاً بحالة `unpaid` ثم يصل هذا الحدث عند التحصيل. بدونه لا
 *   يحصل من دفع بوسيلة مؤجّلة على كريدته أبداً.
 * فريدية `checkout_session_id` في القاعدة تمنع منح الجلسة نفسها مرتين.
 */
export const CREDIT_GRANTING_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
] as const;

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
    checkoutSessionId: null,
  };

  if (!(CREDIT_GRANTING_EVENTS as readonly string[]).includes(event.type)) {
    return base;
  }

  const object = event.data.object;
  const checkoutSessionId =
    typeof object.id === "string" && object.id ? object.id : null;
  const paymentStatus = typeof object.payment_status === "string" ? object.payment_status : null;
  // `no_payment_required` (خصم 100%) لا يمنح حزمة مدفوعة: جلساتنا لا تفعّل
  // أكواد الخصم، فوصول هذه الحالة يعني إعداداً لم نصمّم له — نرفض بأمان.
  if (paymentStatus !== "paid") {
    return { ...base, reason: "unpaid", checkoutSessionId };
  }

  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const clerkId = typeof metadata.clerkId === "string" && metadata.clerkId ? metadata.clerkId : null;
  if (!clerkId) {
    return { ...base, reason: "missing-user", checkoutSessionId };
  }

  const credits = Number(metadata.credits);
  const packId = typeof metadata.packId === "string" ? metadata.packId : null;
  const invalid = { ...base, reason: "invalid-credits" as const, clerkId, packId, checkoutSessionId };
  if (!Number.isInteger(credits) || credits <= 0) {
    return invalid;
  }

  // الحزمة إلزامية ويجب أن تطابق الكريدتات المُعلنة حِزم الخادم: كل جلسة
  // دفع ننشئها نحن تحمل packId، فغيابه يعني جلسة لم تصدر من checkout لدينا.
  const pack = packId ? findCreditPack(packId) : null;
  if (!pack || pack.credits !== credits) {
    return invalid;
  }
  // المبلغ المحصّل (إن وُجد) يجب أن يطابق سعر الحزمة — حراسة ضد جلسة
  // بسعر مختلف (خصم/تلاعب/خطأ تسعير) تمنح حزمة كاملة.
  const amountTotal = object.amount_total;
  const currency = typeof object.currency === "string" ? object.currency.toLowerCase() : null;
  if (
    (typeof amountTotal === "number" && amountTotal !== pack.priceCents) ||
    (currency !== null && currency !== "usd")
  ) {
    return invalid;
  }

  return { grant: true, reason: "granted", clerkId, credits, packId, checkoutSessionId };
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
