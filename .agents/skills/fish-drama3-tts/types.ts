import { z } from "zod";

/** Fish Audio TTS endpoint — نفس المسار لكل الموديلات، والموديل يُختار بالترويسة */
export const FISH_TTS_URL = "https://api.fish.audio/v1/tts";

/**
 * موديل Drama 3 — يُمرَّر في ترويسة `model` بالضبط `drama-3`.
 * تحذير من التوثيق: الترويسة المفقودة أو المكتوبة خطأ لا تفشل الطلب،
 * بل يقع بصمت على `s2.1-pro`. لذلك نرسلها دائماً وثابتاً من الكود.
 */
export const FISH_DRAMA3_MODEL = "drama-3";

/** حد أمان لكل طلب (مشاهد المشروع ≤ 280 حرف، فالمشهد = طلب واحد عادةً) */
export const FISH_SCENE_MAX_CHARS = 1000;

/** صيغ الإخراج التي يقبلها الـ API */
export const FISH_AUDIO_FORMATS = ["mp3", "wav", "pcm", "opus"] as const;
export type FishAudioFormat = (typeof FISH_AUDIO_FORMATS)[number];

/**
 * الوسوم المزدوجة المدعومة رسمياً في Drama 3 — تؤثر على الكلمات
 * المحصورة بين وسمي الفتح والإغلاق فقط.
 */
export const DRAMA_PAIRED_TAGS = [
  "whisper",
  "emphasis",
  "soft",
  "fast",
  "slow",
  "stress",
  "forceful",
] as const;
export type DramaPairedTag = (typeof DRAMA_PAIRED_TAGS)[number];

/**
 * أصوات العرض العامة المستعملة في أمثلة التوثيق (إنجليزية).
 * للعربية: اختر صوتاً من مكتبة الأصوات أو استنسخ صوتك،
 * ومرّر الـ `reference_id` الخاص بك — أو اتركه فارغاً ليستخدم
 * الـ API الصوت الافتراضي.
 */
export const DRAMA_DEMO_VOICES = [
  {
    id: "f3a2b90078d54a65af4b95f63bc7798e",
    name: "Sheila",
    label: "Sheila — صوت مؤنث (EN-US، مثال التوثيق)",
  },
  {
    id: "bf322df2096a46f18c579d0baa36f41d",
    name: "Adrian",
    label: "Adrian — صوت مذكر (EN-US، مثال التوثيق)",
  },
  {
    id: "c70cfb98867a4bfb9ae20d2401257b92",
    name: "Delia",
    label: "Delia — صوت مؤنث (EN-US، مثال التوثيق)",
  },
] as const;

/** مشهد واحد — نفس قيود ShortScene (text ≤ 280) */
export const FishSceneSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(280),
});
export type FishScene = z.infer<typeof FishSceneSchema>;

/** منعطف حوار واحد في مشهد متعدد المتحدثين */
export const DialogueTurnSchema = z.object({
  /** فهرس المتحدث = فهرس صوته في مصفوفة reference_id */
  speaker: z.number().int().min(0).max(9),
  text: z.string().min(1).max(1000),
  /** توجيه أداء اختياري يُحقن قبل النص بين [..] */
  direction: z.string().max(200).optional(),
});
export type DialogueTurn = z.infer<typeof DialogueTurnSchema>;

/** ملف الصوت المحفوظ لمشهد واحد (متزامن مع المشهد) */
export interface FishSceneAudioFile {
  sceneId: string;
  /** النص الأصلي قبل التوجيه */
  text: string;
  /** النص الموجَّه المُرسل فعلاً إلى الـ API */
  directedText: string;
  fileName: string;
  filePath: string;
  totalBytes: number;
}

/** نتيجة توليد الصوت لكل المشاهد */
export interface FishScenesAudioResult {
  /** مجلد التخزين المؤقت: <tmp>/fish-drama3/<hash>/ */
  dir: string;
  manifestPath: string;
  model: typeof FISH_DRAMA3_MODEL;
  /** الـ reference_id المستعمل (صوت واحد أو مصفوفة أصوات) */
  referenceId: string | string[] | null;
  scenes: FishSceneAudioFile[];
}

/** يقرأ مفتاح Fish Audio من البيئة أو من تمريرة صريحة */
export function requireFishKey(explicit?: string): string {
  const key = (explicit ?? process.env.FISH_AUDIO_API_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "FISH_AUDIO_API_KEY غير مضبوط — الصقه في .env.local (احصل على مفتاح من https://fish.audio → API Keys)",
    );
  }
  return key;
}
