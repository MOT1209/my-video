import { describe, expect, test } from "bun:test";
import { clampSummary } from "./summarize";

describe("clampSummary", () => {
  test("المدخل الصالح يمر كما هو", () => {
    const out = clampSummary({
      hook: "خطاف مشوق",
      scenes: [
        { id: "s1", text: "المشهد الأول" },
        { id: "s2", text: "المشهد الثاني" },
      ],
    });
    expect(out.hook).toBe("خطاف مشوق");
    expect(out.scenes).toHaveLength(2);
    expect(out.scenes[0].id).toBe("s1");
  });

  test("الخطاف الطويل يُقصّ إلى 120 حرفاً", () => {
    const out = clampSummary({ hook: "ح".repeat(200), scenes: [{ text: "نص" }] });
    expect(out.hook.length).toBeLessThanOrEqual(120);
  });

  test("أكثر من 12 مشهداً يُقطع عند الحد", () => {
    const scenes = Array.from({ length: 20 }, (_, i) => ({ text: `مشهد ${i}` }));
    const out = clampSummary({ hook: "خطاف", scenes }, 12);
    expect(out.scenes).toHaveLength(12);
    expect(out.scenes[11].id).toBe("s12");
  });

  test("نص المشهد الطويل يُقصّ إلى 280 حرفاً", () => {
    const out = clampSummary({ hook: "خطاف", scenes: [{ text: "ن".repeat(500) }] });
    expect(out.scenes[0].text.length).toBeLessThanOrEqual(280);
  });

  test("المدخل الفاسد يرجع مشهداً احتياطياً واحداً بدل رمي خطأ", () => {
    const out = clampSummary({ garbage: true });
    expect(out.scenes.length).toBeGreaterThanOrEqual(1);
    expect(out.scenes.length).toBeLessThanOrEqual(12);
    expect(out.hook.length).toBeGreaterThan(0);
  });

  test("المعرفات تُطبّع إلى s1..sN", () => {
    const out = clampSummary({
      hook: "خطاف",
      scenes: [{ id: "weird", text: "أ" }, { id: "", text: "ب" }],
    });
    expect(out.scenes.map((s) => s.id)).toEqual(["s1", "s2"]);
  });
});
