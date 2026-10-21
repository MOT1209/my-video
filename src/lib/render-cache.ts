import { createHash } from "node:crypto";
import { head } from "@vercel/blob";

/**
 * كاش ناتج التصيير (المرحلة 3 من الخطة):
 * نفس التركيبة (compositionId + inputProps) = نفسر sha256 = نفس مسار Blob.
 * قبل التصيير نبحث عن المسار عبر head() — إن وُجد نعيد رابط الفيديو الجاهز
 * بدون إنشاء sandbox (التصيير مكلف: دقائق sandbox لكل عملية).
 */

/** بادئة مسار كاش النتائج داخل مخزن Blob. */
export const RENDER_CACHE_PREFIX = "renders-cache";

/**
 * توصيف JSON مستقر: بترتيب مفاتيح محدد وافتراضي.
 * JSON.stringify العادي يعتمد ترتيب الإدخال، فنقنّيه هنا لضمان أن
 * طلبين متكافئين منطقياً ينتجان نفس الهاش حتى لو اختلفت ترتيب الكائنات.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

/**
 * مسار Blob الحتمي لنتيجة تصيير:‏ 설정 التكوين + inputProps.
 * نقتطع 48 محرفاً من الهاش (كافٍ تفادياً للاصطدام وواقعي كطول مسار).
 */
export function renderCachePath(
  compositionId: string,
  inputProps: unknown,
  ownerId?: string,
): string {
  const digest = createHash("sha256")
    .update(stableStringify({ compositionId, inputProps }))
    .digest("hex")
    .slice(0, 48);
  const ownerPath = ownerId
    ? `users/${createHash("sha256").update(ownerId).digest("hex").slice(0, 24)}/`
    : "";
  return `${RENDER_CACHE_PREFIX}/${ownerPath}${compositionId}/${digest}.mp4`;
}

/**
 * يفحص وجود نتيجة بذات المفتاح في Blob.
 * يُعيد null عند غياب النتيجة، ولا يفرط في الخطأ أبداً (فشل الفحص
 * يجب أن يعطل الكاش فقط، لا التصيير).
 */
export async function findCachedRender(
  cachePath: string,
  token?: string,
): Promise<{ url: string; size: number } | null> {
  try {
    const result = await head(cachePath, token ? { token } : undefined);
    return { url: result.url, size: result.size };
  } catch {
    // غير موجود — أو أي عجز في الوثوق الوحيد — كلاهما يعطيل الكاش فقط
    // (لا يفرق بينهما لأن التصيير يواصل بلا أيذا في الحالتين).
    return null;
  }
}
