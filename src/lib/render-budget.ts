import type { Db } from "./db/client";
import { sandboxMsSince } from "./db/repository";

/**
 * حدّ تكلفة يومي للخدمة كلها: مجموع دقائق sandbox في آخر 24 ساعة. إن بلغ
 * الحدّ يُرفض التصيير الجديد (503) قبل أي خصم أو sandbox، فلا يحرق خطأ أو
 * إساءة استخدام ميزانية البنية بلا سقف. معطّل ما لم يُضبط
 * `RENDER_DAILY_SANDBOX_MINUTES` بعدد موجب.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** حدّ الدقائق من البيئة، أو null إن لم يُضبط/كان غير صالح (= معطّل). */
export function dailyBudgetMinutes(
  env: Record<string, string | undefined> = process.env,
): number | null {
  const raw = env.RENDER_DAILY_SANDBOX_MINUTES?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface BudgetVerdict {
  allowed: boolean;
  usedMinutes: number;
  limitMinutes: number | null;
}

export async function checkRenderBudget(
  db: Db,
  now = Date.now(),
  env: Record<string, string | undefined> = process.env,
): Promise<BudgetVerdict> {
  const limitMinutes = dailyBudgetMinutes(env);
  if (limitMinutes === null) {
    return { allowed: true, usedMinutes: 0, limitMinutes: null };
  }
  const usedMs = await sandboxMsSince(db, new Date(now - WINDOW_MS));
  const usedMinutes = usedMs / 60_000;
  return { allowed: usedMinutes < limitMinutes, usedMinutes, limitMinutes };
}
