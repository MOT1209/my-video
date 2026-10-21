import { beforeEach, describe, expect, test } from "bun:test";
import {
  extractArticleText,
  generateScript,
  ScriptResponse,
  validatePublicHttpUrl,
  type FetchLike,
  type ResolveHost,
} from "./script-generator";

/** يبني fetch وهمياً يرد رداً Gemini صحيحاً من نص معطى. */
function fakeLLMFetch(
  responseText: string,
): { fetch: FetchLike; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: responseText }] } },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return { fetch: fetchImpl, calls };
}

const publicResolver: ResolveHost = async () => [{ address: "93.184.216.34", family: 4 }];

const ENV_KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL"] as const;
const savedEnv = ENV_KEYS.map((k) => process.env[k]);

beforeEach(() => {
  ENV_KEYS.forEach((k, i) => {
    const v = savedEnv[i];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  });
  process.env.GEMINI_API_KEY = "fake-key";
});

test("extractArticleText يقطع سكريبتات/أنماط ويقرأ article أولاً", () => {
  const html = `
    <html><body>
      <script>track('ads');</script>
      <style>.a{color:red}</style>
      <nav>القائمة</nav>
      <article>نص المقال الحقيقي IMPORTANT</article>
      <footer>حقوق</footer>
      <div>نص ثانوي</div>
    </body></html>`;
  const text = extractArticleText(html);
  expect(text).toContain("نص المقال الحقيقي");
  expect(text).not.toContain("track");
  expect(text).not.toContain("القائمة");
  expect(text).not.toContain("حقوق");
});

test("extractArticleText يرمي عند صفحة خالية من النص", () => {
  expect(() => extractArticleText("<html><head><title>x</title></head></html>")).toThrow();
});

test("التحقق من الروابط يرفض المضيفين الداخليين والعناوين المختلطة", async () => {
  await expect(
    validatePublicHttpUrl("http://127.0.0.1/admin", publicResolver),
  ).rejects.toThrow("مضيف عام");
  await expect(
    validatePublicHttpUrl("http://metadata.google.internal/", async () => [
      { address: "169.254.169.254", family: 4 },
    ]),
  ).rejects.toThrow("مضيف عام");
  await expect(
    validatePublicHttpUrl("http://example.com/", async () => [{ address: "192.0.2.5", family: 4 }]),
  ).rejects.toThrow("مضيف عام");
  await expect(
    validatePublicHttpUrl("http://example.com/", async () => [{ address: "2002::1", family: 6 }]),
  ).rejects.toThrow("مضيف عام");
  await expect(
    validatePublicHttpUrl("http://example.com/", async () => [{ address: "::ffff:127.0.0.1", family: 6 }]),
  ).rejects.toThrow("مضيف عام");
  await expect(
    validatePublicHttpUrl("https://public.example/", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ]),
  ).rejects.toThrow("مضيف عام");
});

test("التحقق من الرابط يرفض البروتوكولات وبيانات الاعتماد والمضيف المحلي", async () => {
  await expect(validatePublicHttpUrl("file:///etc/passwd", publicResolver)).rejects.toThrow();
  await expect(validatePublicHttpUrl("https://user:pass@example.com/", publicResolver)).rejects.toThrow();
  await expect(validatePublicHttpUrl("https://service.local/", publicResolver)).rejects.toThrow();
  await expect(validatePublicHttpUrl("http://[::1]/", publicResolver)).rejects.toThrow("مضيف عام");
  await expect(validatePublicHttpUrl("http://[fc00::1]/", publicResolver)).rejects.toThrow("مضيف عام");
  await expect(validatePublicHttpUrl("http://[2001:db8::1]/", publicResolver)).rejects.toThrow("مضيف عام");
});

test("يفرض جلب المقال سقف حجم الرد", async () => {
  const oversized = new Uint8Array(2 * 1024 * 1024 + 1);
  const fetchImpl: FetchLike = async () => new Response(oversized);
  await expect(
    generateScript({ url: "https://example.com/large", lang: "ar" }, fetchImpl, publicResolver),
  ).rejects.toThrow("يتجاوز الحد المسموح");
});

test("نقطة المضيف النهائية تُزال قبل حل DNS", async () => {
  let resolvedHostname = "";
  await validatePublicHttpUrl("https://example.com./", async (hostname) => {
    resolvedHostname = hostname;
    return [{ address: "93.184.216.34", family: 4 }];
  });
  expect(resolvedHostname).toBe("example.com");
});

test("ScriptResponse يقبل رداً صالحاً ويرفض تجاوز الحدود", () => {
  expect(
    ScriptResponse.safeParse({ hook: "ح", scenes: ["أ", "ب"] }).success,
  ).toBe(true);
  expect(
    ScriptResponse.safeParse({ hook: "", scenes: ["أ"] }).success,
  ).toBe(false);
  expect(
    ScriptResponse.safeParse({ hook: "ح", scenes: ["أ"], extra: true } as never).success,
  ).toBe(false);
});

test("بدون GEMINI_API_KEY: خطأ واضح", async () => {
  delete process.env.GEMINI_API_KEY;
  const { fetch: unused } = fakeLLMFetch("x");
  await expect(
    generateScript({ topic: "موضوع", lang: "ar" }, unused),
  ).rejects.toThrow("GEMINI_API_KEY");
});

test("بدون url و topic: خطأ صريح", async () => {
  const { fetch: unused } = fakeLLMFetch("x");
  await expect(
    generateScript({ lang: "ar" } as never, unused),
  ).rejects.toThrow("رابط مقال أو موضوع");
});

describe("مسار كامل: رابط → استخراج → LLM → سيناريو", () => {
  test("يحول رداً صحيحاً إلى مشاهد مرقمة", async () => {
    const llmText = JSON.stringify({
      hook: "هل تعلم؟",
      scenes: ["مشهد أولاً", "مشهد ثانٍ.", "اكتب لنا رأيك!"],
    });
    const articleHtml = `<html><body><article>أنا محتوى المقال ويكفي لسؤال، هذا نص طويل كفاية للاختبار.</article></body></html>`;

    let phase: "article" | "llm" = "article";
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      if (phase === "article") {
        phase = "llm";
        return new Response(articleHtml, { status: 200 });
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: llmText }] } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const result = await generateScript(
      { url: "https://example.com/article", lang: "ar" },
      fetchImpl,
      publicResolver,
    );
    expect(calls).toHaveLength(2);
    expect(result.hook).toBe("هل تعلم؟");
    expect(result.scenes).toHaveLength(3);
    expect(result.scenes[0]).toEqual({ id: "s1", text: "مشهد أولاً" });
    expect(result.scenes[2].text).toContain("اكتب");
  });

  test("فشل جلب المقال يعطي خطأ واضحاً", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("not found", { status: 404 });
    await expect(
      generateScript(
        { url: "https://example.com/missing", lang: "ar" },
        fetchImpl,
        publicResolver,
      ),
    ).rejects.toThrow("فشل جلب المقال");
  });

  test("لا يتبع تحويل المقال إلى عنوان آخر", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      requests.push({ url, init });
      return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
    };
    await expect(
      generateScript({ url: "https://example.com/article", lang: "ar" }, fetchImpl, publicResolver),
    ).rejects.toThrow("إعادة توجيه");
    expect(requests).toHaveLength(1);
    expect(requests[0].init?.redirect).toBe("manual");
  });

  test("رد LLM بلا JSON يفشل برسالة مفهومة", async () => {
    const { fetch: badFetch } = fakeLLMFetch("نص عادي بلا JSON");
    await expect(
      generateScript({ topic: "موضوع ما", lang: "en" }, badFetch),
    ).rejects.toThrow();
  });
});
