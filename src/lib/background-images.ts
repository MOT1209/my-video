import { createHash } from "node:crypto";
import { head, put } from "@vercel/blob";

/**
 * صور خلفيات AI — المرحلة 2 من الخطة:
 * ‏POST /api/image → { prompt } → { url } (رابط Blob عام).
 *
 * - النموذج: توليد صور Gemini عبر REST (Nano Banana عائلة الصور) مع
 *   أعزان responseModalities: ["TEXT","IMAGE"] وردّ base64 رضتش inline.
 *   الاسم عبر GEMINI_IMAGE_MODEL (افتراضي gemini-nano-banana-2.1) — يتغير مع الوقت.
 * - **كاش بالـ content-hash** (خطة المرحلة 2): نفس prompt = نفس الصورة =
 *   مفتاح Blob حتمي `backgrounds/{sha256(32)}.png` — فحص head قبل الدفع،
 *   صفر تكلفة توليد متكررة.
 * - المفاتيح خادمية فقط ( نفس نصاصة عليه المثالية في الخطط السابقة).
 */

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

/** نحن 9:16 في المحل: 1080×1920 لإبقاء تصوير الفورزة الثانية (0.9:1.6). */
const IMAGE_PROMPT_SUFFIX =
  " — vertical 9:16 background, no text, no watermark, photographic, high contrast, full-bleed composition";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** مفتاح hash حتمي: نموذج + prompt → مسار Blob ثابت. */
export function backgroundCachePath(model: string, prompt: string): string {
  const digest = createHash("sha256")
    .update(`${model}::${prompt}`)
    .digest("hex")
    .slice(0, 32);
  return `backgrounds/${digest}.png`;
}

/** يُنتج برومبت الخلفية من نص المشهد: يزيل محددات/زحام ونلحق قاعدة الأسلوب. */
export function buildImagePrompt(sceneText: string): string {
  return (
    sceneText
      .replace(/[#*_`>]/g, "")
      .trim()
      .slice(0, 300) + IMAGE_PROMPT_SUFFIX
  );
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }>;
    };
  }>;
}

/** يفضّل أول inlineData صورة في الرد — يرمي خطأ واضحاً عند غيابها. */
function extractImageBytes(payload: GeminiImageResponse): Buffer {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  throw new Error("رد Gemini لم يُرجع صورة inlineData.");
}

export interface GeneratedBackground {
  url: string;
  cached: boolean;
  hash: string;
}

/**
 * يولّد (يستععي من الكاش أولاً) صورة خلفية ثابتة. fetchImpl مُحقن للاختبارات.
 * بلا GEMINI_API_KEY: خطأ عربي واضح يوجه المستخدم للتسليم.
 */
export async function generateBackgroundImage(
  input: { prompt: string; blobToken?: string },
  fetchImpl: FetchLike = fetch,
): Promise<GeneratedBackground> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY غير مُهيأ. أضف مفتاح Google AI Studio إلى متغيرات البيئة (خادم فقط).",
    );
  }
  // القارئ يجعل التمرير الصريح اختياريًا: البيئة هي المرجع موحدًا عبر الواجهات
  const blobToken = input.blobToken ?? process.env.BLOB_READ_WRITE_TOKEN;

  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-nano-banana-2.1";
  const fullPath = backgroundCachePath(model, input.prompt);

  // 1) الكاش أولاً — نفس الربط = URL جاهز بلا أي تكلفة
  if (blobToken) {
    try {
      const existing = await head(fullPath, { token: input.blobToken });
      return {
        url: existing.url,
        cached: true,
        hash: fullPath,
      };
    } catch {
      // غير موجود — نتابع للتوليد
    }
  }

  // 2) التوليد حيًا عبر REST
  const response = await fetchImpl(
    `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: input.prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // نص رد المزوّد يُسجَّل في الخادم فقط — قد يحمل تفاصيل داخلية لا تخصّ العميل
    console.warn("background-images: رد غير ناجح", response.status, detail.slice(0, 300));
    throw new Error(`فشل استدعاء توليد الصورة (${response.status}).`);
  }
  const payload = (await response.json()) as GeminiImageResponse;
  const imageBytes = extractImageBytes(payload);

  // 3) الرفع لمسار حتمي — يلتقته الكاش عند الاستعمال مرات قادمة
  if (!blobToken) {
    throw new Error("BLOB_READ_WRITE_TOKEN مطلوب لتخزين صور الخلفيات.");
  }
  const blob = await put(
    fullPath,
    new Blob([new Uint8Array(imageBytes)], { type: "image/png" }),
    {
      access: "public",
      contentType: "image/png",
      token: blobToken,
      addRandomSuffix: false,
      allowOverwrite: true,
    },
  );

  return { url: blob.url, cached: false, hash: fullPath };
}
