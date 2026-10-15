/**
 * fish-drama3-tts — نقطة الدخول الجامعة.
 *
 * نص عربي/إنجليزي مُوجَّه التمثيل → صوت Drama 3 من Fish Audio،
 * محفوظاً متزامناً مع المشاهد في التخزين المؤقت.
 */
export * from "./types";
export {
  synthesizeDrama3,
  synthesizeScenesAudio,
  chunkTextForFish,
  wrapPairedTag,
  addDirection,
  buildDialogue,
} from "./fish-drama3";
export type { Drama3RequestOptions, SynthesizeScenesOptions } from "./fish-drama3";
