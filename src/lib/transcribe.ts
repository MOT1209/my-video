import { Buffer } from "node:buffer";
import {
  distributeCaptionsEvenly,
  type ShortLang,
  type WordCaption,
} from "../../types/shorts";
import type { FetchLike } from "./script-generator";

/**
 * نسخ الملفات الصوتية المرفوعة (بند ASR من المرحلة 2) عبر Gemini نفسه
 * المستعمل للسكربت والصور — فلا مزوّد جديد ولا مفتاح إضافي.
 *
 * حدود مقصودة:
 * - الطلب يحمل الصوت مضمَّناً (inline base64) ⇒ حد ~20MB عند Gemini،
 *   ونأخذ 15MB هامشاً.
 * - Gemini لا يُرجع توقيت كلمات موثوقاً، فالتوقيت يُوزَّع بالتساوي على
 *   مدة الصوت المعروفة للعميل (نفس أسلوب `distributeCaptionsEvenly`).
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** هامش تحت حد الطلب المضمّن عند Gemini (~20MB). */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const SUPPORTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
] as const;

/** يقبل أنواعاً بصيغة `audio/mpeg; codecs=...` ويقارن الأساس. */
export function isSupportedAudioType(mimeType: string): boolean {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return (SUPPORTED_AUDIO_TYPES as readonly string[]).includes(base);
}

function buildPrompt(lang: ShortLang): string {
  if (lang === "ar") {
    return [
      "انسخ النص المنطوق في هذا الملف الصوتي حرفياً بالعربية.",
      "شروط ملزمة:",
      "1. النص المنطوق فقط — بلا شرح ولا تعليق ولا وصف للأصوات.",
      "2. علامات ترقيم عادية وجُمل قصيرة قابلة للعرض ككابشن.",
      "3. لا تكتب أي شيء غير النص نفسه.",
    ].join("\n");
  }
  return [
    "Transcribe the spoken content of this audio file verbatim in English.",
    "Strict rules:",
    "1. Spoken words only — no commentary, no descriptions of sounds.",
    "2. Normal punctuation, short caption-sized sentences.",
    "3. Output nothing but the transcript itself.",
  ].join("\n");
}

export interface TranscribeInput {
  audio: Uint8Array;
  mimeType: string;
  lang: ShortLang;
  /** مدة الصوت بالثواني (يعرفها العميل) — لتوزيع الكابشن. */
  durationSec?: number | null;
}

export interface TranscribeResult {
  text: string;
  captions: WordCaption[];
  model: string;
}

export async function transcribeAudio(
  input: TranscribeInput,
  fetchImpl: FetchLike = fetch,
): Promise<TranscribeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY غير مُهيأ. أضف مفتاح Google AI Studio إلى متغيرات البيئة (خادم فقط).",
    );
  }
  if (input.audio.byteLength === 0) {
    throw new Error("الملف الصوتي فارغ.");
  }
  if (input.audio.byteLength > MAX_AUDIO_BYTES) {
    throw new Error(
      `حجم الملف يتجاوز الحد المسموح (${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))} ميجابايت).`,
    );
  }
  if (!isSupportedAudioType(input.mimeType)) {
    throw new Error(`صيغة صوتية غير مدعومة: ${input.mimeType || "غير معروفة"}.`);
  }

  const model =
    process.env.GEMINI_TRANSCRIBE_MODEL ??
    process.env.GEMINI_MODEL ??
    "gemini-2.0-flash";

  const response = await fetchImpl(
    `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildPrompt(input.lang) },
              {
                inlineData: {
                  mimeType: input.mimeType,
                  data: Buffer.from(input.audio).toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // نص رد المزوّد يُسجَّل في الخادم فقط — قد يحمل تفاصيل داخلية لا تخصّ العميل
    console.warn("transcribe: رد Gemini غير ناجح", response.status, detail.slice(0, 300));
    throw new Error(`فشل استدعاء Gemini (${response.status}).`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  // استجابة الصوت قد تُقسَّم على أجزاء متعددة — نجمعها قبل التنسيق
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    throw new Error("لم يُرجع النموذج نصاً منطوقاً — قد يكون الملف صامتاً أو غير مفهوم.");
  }

  const durationSec = input.durationSec ?? 0;
  const captions =
    durationSec > 0 ? distributeCaptionsEvenly(text, durationSec) : [];

  return { text, captions, model };
}
