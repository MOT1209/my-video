import { Buffer } from "node:buffer";
import { describe, expect, test } from "bun:test";
import { chunkTextForTts, concatWav } from "./groq-tts";
import { GROQ_TTS_MAX_CHARS } from "./types";

/** بناء ملف WAV صوري: PCM s16 mono */
function makeWav(samples: number[], sampleRate = 8000): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byteRate
  header.writeUInt16LE(2, 32); // blockAlign
  header.writeUInt16LE(16, 34); // bits
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe("chunkTextForTts", () => {
  test("النص القصير يبقى قطعة واحدة", () => {
    expect(chunkTextForTts("مرحباً بالعالم")).toEqual(["مرحباً بالعالم"]);
  });

  test("النص الفارغ يرجع مصفوفة فارغة", () => {
    expect(chunkTextForTts("   ")).toEqual([]);
  });

  test("نص بطول الحد تماماً يبقى قطعة واحدة", () => {
    const t = "أ".repeat(GROQ_TTS_MAX_CHARS);
    expect(chunkTextForTts(t)).toEqual([t]);
  });

  test("كل القطع تحترم حد 200 حرف مهما طال النص", () => {
    const sentence = "هذه جملة عربية متوسطة الطول للاختبار؟ ";
    const long = sentence.repeat(40); // ~1500 حرف
    const chunks = chunkTextForTts(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(GROQ_TTS_MAX_CHARS);
    }
    // لا فقدان للمحتوى (باستثناء المسافات المطبيعة)
    expect(chunks.join(" ").replace(/\s+/g, " ").length).toBeGreaterThan(
      long.length * 0.9,
    );
  });

  test("التقسيم يفضل حدود الجمل العربية (؟)", () => {
    const a = "ما هي أكبر دولة؟ ";
    const b = "الجواب يعتمد على المقياس. ";
    const text = (a + b).repeat(12); // ~600 حرف
    const chunks = chunkTextForTts(text);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(GROQ_TTS_MAX_CHARS);
    }
    // القطعة الأولى يجب أن تنتهي عند حد جملة لا في منتصف كلمة
    expect(chunks[0].length).toBeGreaterThan(50);
  });

  test("الجملة الطويلة بلا ترقيم تُقسم على حدود الكلمات", () => {
    const text = Array.from({ length: 60 }, (_, i) => `كلمة${i}`).join(" ");
    expect(text.length).toBeGreaterThan(GROQ_TTS_MAX_CHARS);
    const chunks = chunkTextForTts(text);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(GROQ_TTS_MAX_CHARS);
      // لا كلمة مقطوعة: كل قطعة تنتهي بكلمة كاملة أو تُستكمل
      expect(c.startsWith(" ")).toBe(false);
      expect(c.endsWith(" ")).toBe(false);
    }
  });

  test("الكلمة الشاذة الأطول من الحد تُقصّ صارماً", () => {
    const word = "ب".repeat(450);
    const chunks = chunkTextForTts(word);
    expect(chunks.length).toBe(3); // 200 + 200 + 50
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(GROQ_TTS_MAX_CHARS);
    }
    expect(chunks.join("")).toBe(word);
  });
});

describe("concatWav", () => {
  test("دمج ملفين متطابقين يجمع العينات ويصحح الترويسة", () => {
    const a = makeWav([100, 200, 300]);
    const b = makeWav([400, 500]);
    const out = concatWav([a, b]);
    expect(out.toString("ascii", 0, 4)).toBe("RIFF");
    expect(out.toString("ascii", 8, 12)).toBe("WAVE");
    expect(out.readUInt32LE(40)).toBe(10); // 5 عينات × 2 بايت
    expect(out.readUInt32LE(4)).toBe(out.length - 8);
    const samples = [0, 1, 2, 3, 4].map((i) => out.readInt16LE(44 + i * 2));
    expect(samples).toEqual([100, 200, 300, 400, 500]);
  });

  test("ملف واحد يُرجع كما هو", () => {
    const a = makeWav([1, 2]);
    expect(concatWav([a]).equals(a)).toBe(true);
  });

  test("يرفض الملفات غير المتوافقة التنسيق", () => {
    const a = makeWav([1, 2], 8000);
    const b = makeWav([3, 4], 16000);
    expect(() => concatWav([a, b])).toThrow(/غير متطابقة/);
  });

  test("يرفض المدخلات غير WAV", () => {
    expect(() => concatWav([Buffer.from("not-a-wav-file....")] as Buffer[])).toThrow(
      /WAV/,
    );
  });

  test("يرفض القائمة الفارغة", () => {
    expect(() => concatWav([])).toThrow();
  });
});
