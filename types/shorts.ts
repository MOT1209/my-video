import { z } from "zod";

export const SHORT_COMP_NAME = "ShortsComp";

export const SHORT_WIDTH = 1080;
export const SHORT_HEIGHT = 1920;
export const SHORT_FPS = 30;
/** حد يوتيوب Shorts في P0: 60 ثانية */
export const SHORT_MAX_SECONDS = 60;
export const SHORT_MAX_FRAMES = SHORT_FPS * SHORT_MAX_SECONDS;
/** هامش أمان نهاية الفيديو بعد آخر كلمة */
export const SHORT_TAIL_SECONDS = 1;

/** مناطق آمنة لتجنب أزرار يوتيوب */
export const SHORT_SAFE_TOP = 160;
export const SHORT_SAFE_BOTTOM = 420;

export const ShortTheme = z.enum(["dark", "paper", "neon", "news", "quotes"]);
export type ShortTheme = z.infer<typeof ShortTheme>;

export const ShortLang = z.enum(["ar", "en"]);
export type ShortLang = z.infer<typeof ShortLang>;

/** أنماط تحريك الكابشن — كل نمط له منطق حركة مختلف داخل WordCaptions */
export const CaptionStyle = z.enum(["pop", "karaoke", "slide-up", "glow"]);
export type CaptionStyle = z.infer<typeof CaptionStyle>;

export const CAPTION_STYLE_LABELS: Record<CaptionStyle, string> = {
  pop: "قفزة (pop)",
  karaoke: "كاريوكي",
  "slide-up": "انزلاق (slide-up)",
  glow: "توهج (glow)",
};

/** خلفية الفيديو: ثيم CSS فقط، أو صورة/فيديو مع تعتيم وحركة Ken Burns */
export const BackgroundMedia = z
  .object({
    type: z.enum(["image", "video"]),
    url: z.string().url(),
    /** تكبير Ken Burns من 1.0 إلى هذا الرقم */
    zoomTo: z.number().min(1).max(1.4).default(1.08),
    /** شدة التعتيم فوق الوسائط لضمان قراءة النص */
    dim: z.number().min(0).max(0.9).default(0.45),
  })
  .nullable()
  .default(null);
export type BackgroundMedia = z.infer<typeof BackgroundMedia>;

/** أصوات Edge-TTS الافتراضية (تعمل بدون مفتاح) */
export const AR_VOICES = [
  { id: "ar-SA-ZariyahNeural", label: "عربي (سعودية) — زارِية", gender: "Female" },
  { id: "ar-SA-HamedNeural", label: "عربي (سعودي) — حامد", gender: "Male" },
] as const;

export const EN_VOICES = [
  { id: "en-US-AvaNeural", label: "English (US) — Ava", gender: "Female" },
  { id: "en-US-AndrewNeural", label: "English (US) — Andrew", gender: "Male" },
] as const;

export const DEFAULT_AR_VOICE = AR_VOICES[0].id;
export const DEFAULT_EN_VOICE = EN_VOICES[0].id;

export const WordCaption = z.object({
  word: z.string().min(1).max(60),
  /** بالثواني */
  start: z.number().min(0),
  end: z.number().min(0),
});
export type WordCaption = z.infer<typeof WordCaption>;

export const ShortScene = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(280),
  imageUrl: z.string().url().nullable().default(null),
});
export type ShortScene = z.infer<typeof ShortScene>;

export const ShortProps = z.object({
  hook: z.string().min(1).max(120),
  scenes: z.array(ShortScene).min(1).max(12),
  theme: ShortTheme.default("dark"),
  lang: ShortLang.default("ar"),
  voiceId: z.string().min(1).max(120).default(DEFAULT_AR_VOICE),
  /** رابط mp3 عام (Blob) أو null قبل توليد الصوت */
  audioUrl: z.string().url().nullable().default(null),
  audioDurationSec: z.number().min(0).max(SHORT_MAX_SECONDS).nullable().default(null),
  captions: z.array(WordCaption).max(600).default([]),
  /** نمط تحريك الكابشن */
  captionStyle: CaptionStyle.default("pop"),
  /** خلفية متحركة (صورة/فيديو) فوق الثيم — اختياري */
  backgroundMedia: BackgroundMedia,
  musicUrl: z.string().url().nullable().default(null),
  musicDuck: z.number().min(0).max(1).default(0.15),
});
export type ShortProps = z.infer<typeof ShortProps>;

export const defaultShortProps: ShortProps = {
  hook: "ثلاث حقائق ستغير طريقة تفكيرك",
  scenes: [
    { id: "s1", text: "عقلك يركز على ما تكرره كل يوم", imageUrl: null },
    { id: "s2", text: "العادة الصغيرة تهزم الحماس الكبير", imageUrl: null },
    { id: "s3", text: "ابدأ اليوم بخطوة واحدة فقط", imageUrl: null },
  ],
  theme: "dark",
  lang: "ar",
  voiceId: DEFAULT_AR_VOICE,
  audioUrl: null,
  audioDurationSec: null,
  captions: [],
  captionStyle: "pop",
  backgroundMedia: null,
  musicUrl: null,
  musicDuck: 0.15,
};

/** نص التعليق الكامل: Hook + المشاهد */
export function buildNarrationText(input: Pick<ShortProps, "hook" | "scenes">): string {
  const parts = [input.hook.trim(), ...input.scenes.map((s) => s.text.trim())].filter(Boolean);
  return parts.join(". ");
}

/**
 * Fallback عند غياب timestamps من TTS:
 * يوزع الكلمات بالتساوي على مدة الصوت.
 */
export function distributeCaptionsEvenly(
  narrationText: string,
  audioDurationSec: number,
): WordCaption[] {
  const words = narrationText.split(/\s+/).filter(Boolean);
  if (words.length === 0 || audioDurationSec <= 0) {
    return [];
  }
  const per = audioDurationSec / words.length;
  return words.map((word, i) => ({
    word,
    start: Number((i * per).toFixed(3)),
    end: Number(((i + 1) * per).toFixed(3)),
  }));
}

/** مدة الفيديو بالفريمات من الكابشن أو الصوت، مع سقف 60 ثانية */
export function getShortDurationInFrames(input: {
  captions: WordCaption[];
  audioDurationSec: number | null;
}): number {
  const lastCaptionEnd =
    input.captions.length > 0 ? Math.max(...input.captions.map((c) => c.end)) : 0;
  const base = Math.max(lastCaptionEnd, input.audioDurationSec ?? 0, 3);
  const total = Math.min(base + SHORT_TAIL_SECONDS, SHORT_MAX_SECONDS);
  return Math.round(total * SHORT_FPS);
}
