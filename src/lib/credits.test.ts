import { expect, test } from "bun:test";
import {
  CREDIT_PACKS,
  findCreditPack,
  formatPackPrice,
  hasEnoughCredits,
  RENDER_CREDIT_COST,
} from "./credits";
import { checkoutParamsForPack, creditsFromStripeEvent } from "./stripe";

/** حدث Checkout مكتمل صالح — الأساس الذي تُبنى عليه بقية الحالات. */
function paidEvent(object: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        payment_status: "paid",
        amount_total: 500,
        currency: "usd",
        metadata: { clerkId: "user_123", packId: "starter", credits: "10" },
        ...object,
      },
    },
  };
}

test("حِزم الكريدت متّسقة: معرّفات فريدة وأسعار وكريدتات موجبة", () => {
  const ids = new Set(CREDIT_PACKS.map((p) => p.id));
  expect(ids.size).toBe(CREDIT_PACKS.length);
  for (const pack of CREDIT_PACKS) {
    expect(pack.credits).toBeGreaterThan(0);
    expect(pack.priceCents).toBeGreaterThan(0);
    expect(findCreditPack(pack.id)).toEqual(pack);
    expect(formatPackPrice(pack)).toMatch(/^\$\d+\.\d{2}$/);
  }
  expect(findCreditPack("غير-موجودة")).toBeNull();
});

test("الحزمة الأكبر أرخص للتصيير الواحد (تسعير متدرّج)", () => {
  const perCredit = CREDIT_PACKS.map((p) => p.priceCents / p.credits);
  for (let i = 1; i < perCredit.length; i += 1) {
    expect(perCredit[i]).toBeLessThan(perCredit[i - 1]);
  }
});

test("كفاية الرصيد تُحسب بتكلفة التصيير", () => {
  expect(hasEnoughCredits(RENDER_CREDIT_COST)).toBe(true);
  expect(hasEnoughCredits(RENDER_CREDIT_COST - 1)).toBe(false);
  expect(hasEnoughCredits(5, 5)).toBe(true);
});

test("حدث دفع مكتمل صالح ⇒ قرار تلقيت", () => {
  const decision = creditsFromStripeEvent(paidEvent());
  expect(decision).toEqual({
    grant: true,
    reason: "granted",
    clerkId: "user_123",
    credits: 10,
    packId: "starter",
    checkoutSessionId: "cs_test_1",
  });
});

test("الدفع المؤجّل يمنح الكريدت عند async_payment_succeeded لا عند الاكتمال غير المدفوع", () => {
  // الجلسة تكتمل أولاً بحالة unpaid (تحويل بنكي مثلاً) ⇒ لا منح
  expect(creditsFromStripeEvent(paidEvent({ payment_status: "unpaid" })).grant).toBe(false);
  // ثم يصل حدث التحصيل لنفس الجلسة ⇒ منح بمفتاح الجلسة نفسها
  const decision = creditsFromStripeEvent({
    ...paidEvent(),
    id: "evt_2",
    type: "checkout.session.async_payment_succeeded",
  });
  expect(decision.grant).toBe(true);
  expect(decision.checkoutSessionId).toBe("cs_test_1");
  // فشل التحصيل المؤجّل لا يمنح شيئاً
  expect(
    creditsFromStripeEvent({ ...paidEvent(), type: "checkout.session.async_payment_failed" }).grant,
  ).toBe(false);
});

test("جلسة بلا حزمة، أو بمبلغ/عملة لا يطابقان الحزمة، أو بلا دفع، لا تمنح", () => {
  expect(
    creditsFromStripeEvent(paidEvent({ metadata: { clerkId: "user_123", credits: "10" } })).reason,
  ).toBe("invalid-credits");
  expect(creditsFromStripeEvent(paidEvent({ amount_total: 1 })).reason).toBe("invalid-credits");
  expect(creditsFromStripeEvent(paidEvent({ currency: "eur" })).reason).toBe("invalid-credits");
  expect(
    creditsFromStripeEvent(paidEvent({ payment_status: "no_payment_required", amount_total: 0 }))
      .reason,
  ).toBe("unpaid");
});

test("حالات لا تمنح كريدت: نوع آخر، دفع غير مكتمل، بلا مستخدم، كريدت غير صالح", () => {
  expect(creditsFromStripeEvent({ ...paidEvent(), type: "payment_intent.succeeded" }).reason).toBe(
    "ignored-type",
  );
  expect(
    creditsFromStripeEvent(paidEvent({ payment_status: "unpaid" })).reason,
  ).toBe("unpaid");
  expect(
    creditsFromStripeEvent(paidEvent({ metadata: { packId: "starter", credits: "10" } })).reason,
  ).toBe("missing-user");
  for (const credits of ["0", "-5", "abc", ""]) {
    const reason = creditsFromStripeEvent(
      paidEvent({ metadata: { clerkId: "user_123", packId: "starter", credits } }),
    ).reason;
    expect(reason).toBe("invalid-credits");
  }
});

test("عدم تطابق عدد الكريدتات مع الحزمة يُرفض (حراسة ضد خطأ من جهتنا)", () => {
  const decision = creditsFromStripeEvent(
    paidEvent({ metadata: { clerkId: "user_123", packId: "starter", credits: "100" } }),
  );
  expect(decision.grant).toBe(false);
  expect(decision.reason).toBe("invalid-credits");

  const unknownPack = creditsFromStripeEvent(
    paidEvent({ metadata: { clerkId: "user_123", packId: "nope", credits: "10" } }),
  );
  expect(unknownPack.reason).toBe("invalid-credits");
});

test("Checkout يستخدم price_data بلا منتجات مُنشأة مسبقاً ويحمل metadata التلقيت", () => {
  const pack = CREDIT_PACKS[0];
  const params = checkoutParamsForPack(pack, {
    clerkId: "user_123",
    origin: "https://app.example",
  });
  expect(params.mode).toBe("payment");
  expect(params.line_items[0].quantity).toBe(1);
  expect(params.line_items[0].price_data.unit_amount).toBe(pack.priceCents);
  expect(params.line_items[0].price_data.currency).toBe("usd");
  expect(params.metadata).toEqual({
    clerkId: "user_123",
    packId: pack.id,
    credits: String(pack.credits),
  });
  expect(params.success_url.startsWith("https://app.example/")).toBe(true);
  expect(params.cancel_url.startsWith("https://app.example/")).toBe(true);
});
