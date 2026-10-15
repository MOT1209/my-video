/**
 * url-groq-video-generator — نقطة الدخول الجامعة.
 *
 * رابط ويب → كشط (cheerio) → تلخيص (Groq llama3-8b-8192) →
 * صوت عربي (Groq canopylabs/orpheus-arabic-saudi) مجزأً ≤200 حرف
 * ومحفوظاً متزامناً مع المشاهد في التخزين المؤقت.
 */
import { buildNarrationText, type ShortProps } from "../../../types/shorts";
import { scrapeUrl, type ScrapedArticle } from "./scrape";
import { summarizeWithGroq } from "./summarize";
import { synthesizeScenesAudio } from "./groq-tts";
import type { GroqArabicVoiceId, GroqSummary, ScenesAudioResult } from "./types";

export * from "./types";
export { scrapeUrl, extractArticleText, MAX_SCRAPE_CHARS } from "./scrape";
export type { ScrapedArticle, ScrapeOptions } from "./scrape";
export { summarizeWithGroq, clampSummary } from "./summarize";
export type { SummarizeOptions } from "./summarize";
export {
  chunkTextForTts,
  synthesizeChunk,
  synthesizeScenesAudio,
  concatWav,
} from "./groq-tts";
export type { SynthesizeScenesOptions } from "./groq-tts";

export interface GenerateFromUrlOptions {
  apiKey?: string;
  voice?: GroqArabicVoiceId;
  /** عدد المشاهد المطلوب (1..12) — الافتراضي 8 */
  maxScenes?: number;
  /** إنتاج combined.wav — الافتراضي true */
  combineAudio?: boolean;
}

export interface GenerateFromUrlResult {
  article: ScrapedArticle;
  summary: GroqSummary;
  /** مدخل جاهز لـ ShortProps مباشرة */
  shortPropsInput: Pick<ShortProps, "hook" | "scenes">;
  /** نص التعليق الكامل (Hook + المشاهد) */
  narrationText: string;
  audio: ScenesAudioResult;
}

/** خط الأنابيب الكامل: رابط → سكربت + صوت */
export async function generateShortFromUrl(
  url: string,
  opts: GenerateFromUrlOptions = {},
): Promise<GenerateFromUrlResult> {
  const article = await scrapeUrl(url);
  const summary = await summarizeWithGroq(article, {
    apiKey: opts.apiKey,
    maxScenes: opts.maxScenes,
  });
  const audio = await synthesizeScenesAudio(summary.scenes, {
    apiKey: opts.apiKey,
    voice: opts.voice,
    combine: opts.combineAudio ?? true,
  });

  const shortPropsInput: Pick<ShortProps, "hook" | "scenes"> = {
    hook: summary.hook,
    scenes: summary.scenes.map((s) => ({
      id: s.id,
      text: s.text,
      imageUrl: s.imageUrl,
    })),
  };

  return {
    article,
    summary,
    shortPropsInput,
    narrationText: buildNarrationText(summary),
    audio,
  };
}
