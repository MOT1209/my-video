import { NextResponse } from "next/server";
import { apiError } from "../../../../helpers/api-response";
import { getDb } from "../../../../lib/db/client";
import { applyStripeCreditGrant, ensureUser } from "../../../../lib/db/repository";
import { creditsFromStripeEvent, getStripe, toStripeEventLike } from "../../../../lib/stripe";

/**
 * ويب هوك Stripe — المصدر الموثوق للتلقيت (لا نصدّق رد العميل بعد الدفع).
 *
 * قواعد الرد مقصودة:
 * - 2xx دائماً عند نجاح المعالجة أو عند حدث لا يخصّنا (وإلا أعادت Stripe
 *   إرساله للأبد).
 * - 5xx عند تعذّر التطبيق (قاعدة بيانات معطّلة مثلاً) ⇒ تُعيد Stripe
 *   المحاولة، ووجود منع التكرار في SQL يجعل الإعادة آمنة.
 * - التوقيع يُتحقَّق دائماً قبل أي كتابة؛ حدث بلا توقيع صالح = 400.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return apiError(
      "الفوترة غير مهيأة على الخادم: STRIPE_SECRET_KEY و STRIPE_WEBHOOK_SECRET مطلوبان.",
      503,
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return apiError("توقيع Stripe مفقود.", 400);
  }

  const payload = await req.text();
  const event = await stripe.webhooks
    .constructEventAsync(payload, signature, webhookSecret)
    .catch(() => null);
  if (!event) {
    console.warn("billing/webhook: توقيع غير صالح — رُفض الحدث");
    return apiError("توقيع غير صالح.", 400);
  }

  const decision = creditsFromStripeEvent(toStripeEventLike(event));
  if (!decision.grant || !decision.clerkId) {
    // حدث لا يخصّ الكريدت (أو دفع غير مكتمل) — نُقرّ الاستلام ولا نعمل شيئاً
    return NextResponse.json({
      received: true,
      applied: false,
      reason: decision.reason,
    });
  }

  const db = getDb();
  if (!db) {
    return apiError("قاعدة البيانات غير مهيأة — ستُعيد Stripe المحاولة.", 503);
  }

  try {
    const user = await ensureUser(db, { clerkId: decision.clerkId });
    const result = await applyStripeCreditGrant(db, {
      eventId: event.id,
      type: event.type,
      userId: user.id,
      credits: decision.credits,
      meta: { packId: decision.packId },
    });
    return NextResponse.json({
      received: true,
      applied: result.applied,
      duplicate: result.duplicate,
    });
  } catch (err) {
    console.error("billing/webhook: فشل التطبيق — ستُعيد Stripe المحاولة", err);
    return apiError("تعذّر تطبيق حدث الدفع.", 500);
  }
}
