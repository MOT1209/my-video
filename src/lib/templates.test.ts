import { describe, expect, test } from "bun:test";
import { AR_VOICES, buildNarrationText, EN_VOICES, ShortProps, defaultShortProps } from "../../types/shorts";
import { findTemplate, SHORT_TEMPLATES } from "../../types/templates";

const MAX_TTS_CHARS = 1000;
const VOICES: readonly string[] = [...AR_VOICES, ...EN_VOICES].map((v) => v.id);

describe("SHORT_TEMPLATES", () => {
  test("معرّفات فريدة وقائمة غير فارغة", () => {
    const ids = SHORT_TEMPLATES.map((t) => t.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const template of SHORT_TEMPLATES) {
    describe(template.id, () => {
      const scenes = template.scenes.map((text, i) => ({
        id: `s${i + 1}`,
        text,
        imageUrl: null,
      }));

      test("يُنتج ShortProps صالحاً للتصيير", () => {
        const parsed = ShortProps.safeParse({
          ...defaultShortProps,
          hook: template.hook,
          scenes,
          theme: template.theme,
          lang: template.lang,
          voiceId: template.voiceId,
          captionStyle: template.captionStyle,
        });
        expect(parsed.success).toBe(true);
      });

      test("نص التعليق ضمن حد TTS وبلا مشاهد فارغة", () => {
        expect(buildNarrationText({ hook: template.hook, scenes }).length).toBeLessThanOrEqual(MAX_TTS_CHARS);
        expect(template.scenes.every((s) => s.trim().length > 0)).toBe(true);
        expect(template.scenes.length).toBeLessThanOrEqual(12);
      });

      test("الصوت معروف ويطابق لغة القالب", () => {
        expect(VOICES).toContain(template.voiceId);
        expect(template.voiceId.startsWith(template.lang)).toBe(true);
      });
    });
  }

  test("findTemplate", () => {
    expect(findTemplate("ar-facts")?.label).toBe("حقائق مدهشة");
    expect(findTemplate("nope")).toBeUndefined();
  });
});
