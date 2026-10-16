/**
 * منطق الكريدت — نقي وبلا اعتماد على قاعدة بيانات أو Stripe،
 * فيبقى قابلاً للاختبار ولإعادة الاستعمال في الويب هوك والواجهة معاً.
 */

/** تصيير واحد = كريدت واحد (نموذج قياس الاستهلاك الأبسط). */
export const RENDER_CREDIT_COST = 1;

/** كريدتات ترحيبية عند أول تسجيل دخول (تكفي لتجربة المنتج كاملاً). */
export const FREE_SIGNUP_CREDITS = 3;

export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  /** بالسنت — يُمرَّر لـ Stripe `unit_amount` مباشرة. */
  priceCents: number;
}

/**
 * حِزم الكريدت — تُنشَأ أسعارها لحظياً عبر `price_data` في Stripe Checkout،
 * فلا حاجة لإنشاء Products/Prices يدوياً في لوحة Stripe.
 */
export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: "starter", label: "10 تصييرات", credits: 10, priceCents: 500 },
  { id: "creator", label: "30 تصييراً", credits: 30, priceCents: 1200 },
  { id: "studio", label: "100 تصيير", credits: 100, priceCents: 3500 },
] as const;

export function findCreditPack(id: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

/** نص العرض: "$5.00 (0.50$ للتصيير)" — يُستخدم في الواجهة. */
export function formatPackPrice(pack: CreditPack): string {
  return `$${(pack.priceCents / 100).toFixed(2)}`;
}

/** هل يكفي الرصيد لعملية بتكلفة معينة؟ */
export function hasEnoughCredits(credits: number, cost = RENDER_CREDIT_COST): boolean {
  return credits >= cost;
}
