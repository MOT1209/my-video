import { defaultShortProps, type ShortScene } from "../../types/shorts";

/** أقصى عدد مشاهد يقبله المحرّر (سطر لكل مشهد). */
export const MAX_EDITOR_SCENES = 12;

/** النص الافتراضي للمشاهد كما يظهر في صندوق النص. */
export const DEFAULT_SCENES_TEXT = defaultShortProps.scenes.map((s) => s.text).join("\n");

/** يحوّل صندوق النص (سطر = مشهد) إلى مشاهد: يقصّ الأسطر الفارغة ويحدّ العدد. */
export function parseScenes(scenesText: string): ShortScene[] {
  return scenesText
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_EDITOR_SCENES)
    .map((text, i) => ({ id: `s${i + 1}`, text, imageUrl: null }));
}

/** عكس `parseScenes`: نصوص المشاهد في صندوق نص واحد. */
export function scenesToText(scenes: Array<{ text: string }>): string {
  return scenes.map((s) => s.text).join("\n");
}

/** هل المحرّر ما زال على النص الافتراضي (فلا حاجة لتأكيد قبل استبداله بقالب)؟ */
export function isUntouchedDraft(hook: string, scenesText: string): boolean {
  return hook === defaultShortProps.hook && scenesText === DEFAULT_SCENES_TEXT;
}

/** رابط http(s) أم موضوع نصي؟ (مصدر توليد السكربت) */
export function isUrlSource(source: string): boolean {
  return /^https?:\/\//i.test(source.trim());
}
