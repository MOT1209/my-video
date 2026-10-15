import { z } from "zod";

/** Groq OpenAI-compatible endpoints */
export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_TTS_URL = "https://api.groq.com/openai/v1/audio/speech";

/** نموذج التلخيص المجاني */
export const GROQ_SUMMARY_MODEL = "llama3-8b-8192";
/** نموذج الصوت العربي (سعودي) */
export const GROQ_ARABIC_TTS_MODEL = "canopylabs/orpheus-arabic-saudi";

/** الحد الأقصى لمدخل النص في طلب TTS واحد لهذا النموذج */
export const GROQ_TTS_MAX_CHARS = 200;

/** الأصوات العربية المدعومة في النموذج */
export const GROQ_ARABIC_VOICES = [
  { id: "fahad", label: "فهد — صوت مذكر", gender: "Male" },
  { id: "noura", label: "نورة — صوت مؤنث", gender: "Female" },
] as const;

export type GroqArabicVoiceId = (typeof GROQ_ARABIC_VOICES)[number]["id"];

export const DEFAULT_GROQ_ARABIC_VOICE: GroqArabicVoiceId = "noura";

/**
 * مشهد واحد — نفس قيود ShortScene في types/shorts.ts
 * (hook ≤ 120، text ≤ 280، scenes ≤ 12)
 */
export const GroqSceneSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(280),
  imageUrl: z.string().url().nullable().default(null),
});
export type GroqScene = z.infer<typeof GroqSceneSchema>;

/** ناتج التلخيص: خطاف + مشاهد — يتوافق مباشرة مع ShortProps */
export const GroqSummarySchema = z.object({
  hook: z.string().min(1).max(120),
  scenes: z.array(GroqSceneSchema).min(1).max(12),
});
export type GroqSummary = z.infer<typeof GroqSummarySchema>;

/** مقطع صوتي واحد مولّد من Groq TTS */
export interface TtsChunkAudio {
  index: number;
  text: string;
  wav: Buffer;
}

/** ملف الصوت المحفوظ لمشهد واحد (متزامن مع المشهد) */
export interface SceneAudioFile {
  sceneId: string;
  text: string;
  fileName: string;
  filePath: string;
  /** القطع النصية (≤200 حرف) التي دُمجت في هذا الملف */
  chunks: Array<{ index: number; chars: number }>;
  totalBytes: number;
}

/** نتيجة توليد الصوت لكل المشاهد */
export interface ScenesAudioResult {
  /** مجلد التخزين المؤقت: <tmp>/groq-shorts/<hash>/ */
  dir: string;
  manifestPath: string;
  voice: string;
  model: string;
  scenes: SceneAudioFile[];
  /** ملف مدمج لكل المشاهد بالترتيب، أو null إن طُلب بدونه */
  combinedWavPath: string | null;
}

export function requireGroqKey(explicit?: string): string {
  const key = (explicit ?? process.env.GROQ_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "GROQ_API_KEY غير مضبوط — أضفه إلى .env.local (احصل على مفتاح مجاني من https://console.groq.com)",
    );
  }
  return key;
}
