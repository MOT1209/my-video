/**
 * إعدادات Gemini REST المشتركة.
 *
 * المفتاح يُرسل في ترويسة `x-goog-api-key` لا في query string: الروابط
 * تُسجَّل في سجلات الوكلاء/APM ورسائل أخطاء undici، والترويسة لا.
 */
export const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiGenerateUrl(model: string): string {
  return `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;
}

export function geminiHeaders(apiKey: string): Record<string, string> {
  return { "content-type": "application/json", "x-goog-api-key": apiKey };
}
