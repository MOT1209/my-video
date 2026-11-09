import { expect, test } from "bun:test";
import { defaultShortProps } from "../../types/shorts";
import {
  DEFAULT_SCENES_TEXT,
  isUntouchedDraft,
  isUrlSource,
  MAX_EDITOR_SCENES,
  parseScenes,
  scenesToText,
} from "./editor-scenes";

test("parseScenes: يقصّ الفراغ ويتجاهل الأسطر الفارغة ويرقّم المعرّفات", () => {
  const scenes = parseScenes("  أول \n\n   \nثانٍ\n");
  expect(scenes).toEqual([
    { id: "s1", text: "أول", imageUrl: null },
    { id: "s2", text: "ثانٍ", imageUrl: null },
  ]);
});

test("parseScenes: يحدّ العدد بـ MAX_EDITOR_SCENES", () => {
  const text = Array.from({ length: 30 }, (_, i) => `مشهد ${i + 1}`).join("\n");
  const scenes = parseScenes(text);
  expect(scenes).toHaveLength(MAX_EDITOR_SCENES);
  expect(scenes.at(-1)?.id).toBe(`s${MAX_EDITOR_SCENES}`);
});

test("parseScenes: نص فارغ ⇒ لا مشاهد", () => {
  expect(parseScenes("")).toEqual([]);
  expect(parseScenes("\n \n")).toEqual([]);
});

test("scenesToText عكس parseScenes للنصوص النظيفة", () => {
  const text = "أ\nب\nج";
  expect(scenesToText(parseScenes(text))).toBe(text);
  expect(scenesToText([])).toBe("");
});

test("isUntouchedDraft: الافتراضي فقط", () => {
  expect(isUntouchedDraft(defaultShortProps.hook, DEFAULT_SCENES_TEXT)).toBe(true);
  expect(isUntouchedDraft("خطاف مختلف", DEFAULT_SCENES_TEXT)).toBe(false);
  expect(isUntouchedDraft(defaultShortProps.hook, `${DEFAULT_SCENES_TEXT}\nإضافة`)).toBe(false);
});

test("isUrlSource: http(s) فقط، ويتجاهل الفراغ الأولي", () => {
  expect(isUrlSource("https://example.com/a")).toBe(true);
  expect(isUrlSource("  HTTP://example.com")).toBe(true);
  expect(isUrlSource("ftp://example.com")).toBe(false);
  expect(isUrlSource("موضوع عادي")).toBe(false);
});
