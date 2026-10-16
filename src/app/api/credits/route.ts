import { apiSuccess } from "../../../helpers/api-response";
import { CREDIT_PACKS, formatPackPrice, RENDER_CREDIT_COST } from "../../../lib/credits";
import { usageSummary } from "../../../lib/db/repository";
import { isStripeConfigured } from "../../../lib/stripe";
import { requireSession } from "../../../lib/session";

/** رصيد الكريدت + لوحة الاستهلاك + حزم الشراء المتاحة. */
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) {
    return guard.response;
  }
  const { db, user } = guard.session;
  const usage = await usageSummary(db, user.id);

  return apiSuccess({
    credits: user.credits,
    plan: user.plan,
    renderCost: RENDER_CREDIT_COST,
    /** هل الفوترة مفعّلة على الخادم؟ (الواجهة تُخفي زر الشراء إن لا) */
    billingEnabled: isStripeConfigured(),
    packs: CREDIT_PACKS.map((pack) => ({
      id: pack.id,
      label: pack.label,
      credits: pack.credits,
      price: formatPackPrice(pack),
    })),
    usage,
  });
}
