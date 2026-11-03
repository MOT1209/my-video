import { NextResponse } from "next/server";
import { checkReadiness, isReady } from "../../../lib/readiness";
import { hasValidCronSecret } from "../../../lib/secret";

/**
 * فحص الصحة والجاهزية.
 *
 * - بلا سر: `{ status: "ok" }` دائماً (مجرد أن التطبيق يرد) — يصلح لمراقب
 *   uptime عام ولا يكشف شيئاً عن الإعداد.
 * - مع `Authorization: Bearer <CRON_SECRET>`: قائمة المتغيرات الناقصة وأثرها،
 *   ورمز 503 إن نقص شيء مطلوب للإنتاج. أسماء المتغيرات وحالتها فقط، لا قيم،
 *   ولا تُعرض لغير حامل السر (معرفة ما ينقص تفيد المهاجم).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ status: "ok" });
  }
  const checks = checkReadiness();
  const ready = isReady(checks);
  return NextResponse.json(
    {
      status: ready ? "ready" : "degraded",
      production: process.env.NODE_ENV === "production",
      checks: checks.map(({ id, vars, required, ok, impact }) => ({
        id,
        vars,
        required,
        ok,
        impact,
      })),
      missingRequired: checks.filter((c) => c.required && !c.ok).map((c) => c.id),
      missingOptional: checks.filter((c) => !c.required && !c.ok).map((c) => c.id),
    },
    { status: ready ? 200 : 503 },
  );
}
