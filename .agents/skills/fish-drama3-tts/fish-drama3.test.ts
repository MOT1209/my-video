import { describe, expect, test } from "bun:test";
import {
  addDirection,
  buildDialogue,
  chunkTextForFish,
  wrapPairedTag,
} from "./fish-drama3";
import { FISH_SCENE_MAX_CHARS, requireFishKey } from "./types";

describe("chunkTextForFish", () => {
  test("النص القصير يبقى قطعة واحدة", () => {
    expect(chunkTextForFish("مرحباً بالعالم")).toEqual(["مرحباً بالعالم"]);
  });

  test("النص الفارغ يرجع مصفوفة فارغة", () => {
    expect(chunkTextForFish("   ")).toEqual([]);
  });

  test("كل القطع تحترم الحد مهما طال النص", () => {
    const sentence = "هذه جملة عربية متوسطة الطول للاختبار؟ ";
    const long = sentence.repeat(60); // ~2400 حرف
    const chunks = chunkTextForFish(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(FISH_SCENE_MAX_CHARS);
    }
  });

  test("التقسيم يفضل حدود الجمل العربية (؟)", () => {
    const text = "ما هي أكبر دولة؟ الجواب يعتمد على المقياس. ".repeat(30);
    const chunks = chunkTextForFish(text, 200);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(200);
    }
    expect(chunks[0].length).toBeGreaterThan(50);
  });

  test("الجملة الطويلة بلا ترقيم تُقسم على حدود الكلمات", () => {
    const text = Array.from({ length: 300 }, (_, i) => `كلمة${i}`).join(" ");
    const chunks = chunkTextForFish(text, 200);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(200);
      expect(c.startsWith(" ")).toBe(false);
      expect(c.endsWith(" ")).toBe(false);
    }
  });
});

describe("wrapPairedTag", () => {
  test("يغلّف الكلمات بالوسم المزدوج", () => {
    expect(wrapPairedTag("Go on without me", "whisper")).toBe(
      "<whisper>Go on without me</whisper>",
    );
  });

  test("يرفض الوسم غير المدعوم", () => {
    expect(() => wrapPairedTag("نص", "shout" as never)).toThrow(/غير مدعوم/);
  });

  test("يرفض النص الفارغ", () => {
    expect(() => wrapPairedTag("   ", "slow")).toThrow();
  });
});

describe("addDirection", () => {
  test("يحقن التوجيه العربي بين أقواس مربعة", () => {
    expect(addDirection("أنا بخير", "بصوت مكسور يكتم البكاء")).toBe(
      "[بصوت مكسور يكتم البكاء] أنا بخير",
    );
  });

  test("التوجيه الفارغ يرجع النص كما هو", () => {
    expect(addDirection("أنا بخير", "   ")).toBe("أنا بخير");
  });

  test("يرفض النص الفارغ", () => {
    expect(() => addDirection("  ", "حزين")).toThrow();
  });
});

describe("buildDialogue", () => {
  test("يبني حوار متحدثين بوسوم speaker", () => {
    const out = buildDialogue([
      { speaker: 0, text: "كنت هناك تلك الليلة.", direction: "نبرة اتهام هادئة" },
      { speaker: 1, text: "كنت في البيت. نائماً." },
    ]);
    expect(out).toBe(
      "<|speaker:0|>[نبرة اتهام هادئة] كنت هناك تلك الليلة.<|speaker:1|>كنت في البيت. نائماً.",
    );
  });

  test("يرفض القائمة الفارغة", () => {
    expect(() => buildDialogue([])).toThrow();
  });
});

describe("requireFishKey", () => {
  test("يرفض عند غياب المفتاح", () => {
    const saved = process.env.FISH_AUDIO_API_KEY;
    delete process.env.FISH_AUDIO_API_KEY;
    expect(() => requireFishKey()).toThrow(/FISH_AUDIO_API_KEY/);
    if (saved !== undefined) {
      process.env.FISH_AUDIO_API_KEY = saved;
    }
  });

  test("يقبل مفتاحاً صريحاً", () => {
    expect(requireFishKey("  abc123  ")).toBe("abc123");
  });
});
