import { FREE_SIGNUP_CREDITS } from "./credits";
import { checkRateLimit, ipFromHeaders } from "./rate-limit";

/**
 * حماية كريدت الترحيب المجاني من حسابات البوتات.
 *
 * كل حساب جديد يأخذ كريدتات مجانية تُصرف على تصيير حقيقي (دقائق sandbox)،
 * فإنشاء حسابات بالجملة = تصيير مجاني بلا حد. الحماية هنا طبقة ثانية خلف
 * حماية Clerk نفسها (Bot protection / CAPTCHA في لوحة Clerk، انظر README):
 *
 * 1) بريد مؤقت معروف (mailinator وأشباهه) ⇒ بلا كريدت مجاني.
 * 2) سقف لعدد الحسابات الجديدة التي تُمنح كريدتاً لكل IP كل 24 ساعة.
 *
 * من يُحجب عنه الكريدت المجاني يبقى حساباً عادياً يستطيع شراء كريدت؛ لا
 * نحجب التسجيل نفسه (الخطأ هنا يكلّف مستخدماً حقيقياً كريدت لا حسابه).
 * تُطبَّق فقط عند إنشاء الصف أول مرة — الحسابات القائمة لا تتأثر.
 */

export const SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_FREE_SIGNUPS_PER_IP = 3;

/**
 * نطاقات بريد مؤقت شائعة. القائمة ناقصة بطبيعتها (تظهر نطاقات جديدة كل يوم)،
 * فهي تقطع أسهل الحالات فقط، والسقف بالـ IP وحماية Clerk هما الأساس.
 */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "trashmail.com",
  "trashmail.net",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "fakeinbox.com",
  "spamgourmet.com",
  "emailondeck.com",
  "moakt.com",
  "mohmal.com",
  "tmpmail.org",
  "tmpmail.net",
  "burnermail.io",
  "mytemp.email",
  "inboxkitten.com",
  "mail.tm",
  "discard.email",
  "anonaddy.me",
]);

export function isDisposableEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const at = email.lastIndexOf("@");
  if (at < 0) {
    return false;
  }
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return true;
  }
  // نطاقات فرعية (x.mailinator.com) تُعامل كالنطاق الأم
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i += 1) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(parts.slice(i).join("."))) {
      return true;
    }
  }
  return false;
}

export function freeSignupsPerIp(
  env: Record<string, string | undefined> = process.env,
): number {
  const parsed = Number.parseInt(env.SIGNUP_FREE_PER_IP_PER_DAY ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_FREE_SIGNUPS_PER_IP;
}

export type SignupCreditsDecision =
  | { credits: number; reason: "granted" }
  | { credits: 0; reason: "disposable-email" | "ip-limit" | "limiter-unavailable" };

export interface SignupGuardDeps {
  /** IP الطلب؛ غائب خارج سياق طلب (اختبار/سكربت) ⇒ لا حد بالـ IP. */
  ip?: string | null;
  limit?: typeof checkRateLimit;
  perIpLimit?: number;
}

/**
 * يقرّر كريدت الترحيب لحساب جديد. لا يرمي أبداً: أي تعذّر في الفحص يعني
 * «بلا كريدت مجاني» (يفشل مغلقاً) بدل منح كريدت بلا فحص.
 */
export async function decideSignupCredits(
  email: string | null | undefined,
  deps: SignupGuardDeps = {},
): Promise<SignupCreditsDecision> {
  if (isDisposableEmail(email)) {
    return { credits: 0, reason: "disposable-email" };
  }
  const ip = deps.ip;
  if (ip && ip !== "unknown") {
    const limit = deps.limit ?? checkRateLimit;
    const max = deps.perIpLimit ?? freeSignupsPerIp();
    try {
      const verdict = await limit(`signup-credits:${ip}`, max, SIGNUP_WINDOW_MS);
      if (verdict.unavailable) {
        return { credits: 0, reason: "limiter-unavailable" };
      }
      if (!verdict.allowed) {
        return { credits: 0, reason: "ip-limit" };
      }
    } catch (err) {
      console.error("signup-guard: تعذّر فحص حد الـ IP — بلا كريدت مجاني", err);
      return { credits: 0, reason: "limiter-unavailable" };
    }
  }
  return { credits: FREE_SIGNUP_CREDITS, reason: "granted" };
}

/** IP الطلب الحالي من سياق Next (يُرجع null خارج طلب). */
async function currentRequestIp(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    return ipFromHeaders(await headers());
  } catch {
    return null;
  }
}

/**
 * مُقرِّر كريدت الترحيب لاستدعاء `ensureUser`: يُنفَّذ فقط إن كان الحساب جديداً،
 * ويسجّل سبب الحجب في سجل الخادم (بلا بريد ولا IP كاملين).
 */
export function signupCreditsResolver(
  email: string | null | undefined,
): () => Promise<number> {
  return async () => {
    const decision = await decideSignupCredits(email, { ip: await currentRequestIp() });
    if (decision.reason !== "granted") {
      console.warn(`signup-guard: حساب جديد بلا كريدت مجاني (${decision.reason})`);
    }
    return decision.credits;
  };
}
