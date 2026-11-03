/**
 * خطأ رسالته مكتوبة عمداً للمستخدم (عربية، بلا تفاصيل داخلية).
 *
 * المسارات تعرض رسالة هذا الصنف فقط؛ أي خطأ آخر (رسالة SDK، ‏`fetch failed`،
 * نص Zod، رد مزوّد) يُستبدل برسالة عامة ويُسجَّل في الخادم وحده — حتى لا
 * تتسرب عناوين داخلية أو مفاتيح أو بنية النظام للعميل.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export const GENERIC_ERROR_MESSAGE =
  "تعذّر إكمال الطلب. حاول مرة أخرى بعد قليل.";

/** الرسالة الآمنة للعرض: رسالة UserFacingError أو الرسالة العامة. */
export function publicErrorMessage(
  err: unknown,
  fallback: string = GENERIC_ERROR_MESSAGE,
): string {
  return err instanceof UserFacingError && err.message ? err.message : fallback;
}
