import { afterEach, expect, test } from "bun:test";
import { requestBackground, requestNarration, requestScript } from "./editor-api";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "null")) });
    return handler(String(input), init ?? {});
  }) as typeof fetch;
  return calls;
}

const ok = (data: unknown) => Response.json({ type: "success", data });

test("requestScript: رابط يُرسل url، وموضوع يُرسل topic", async () => {
  const calls = mockFetch(() => ok({ hook: "h", scenes: [{ text: "a" }] }));
  const a = await requestScript({ source: "https://x.com/a", isUrl: true, lang: "ar" });
  const b = await requestScript({ source: "العادات", isUrl: false, lang: "en" });
  expect(a.hook).toBe("h");
  expect(b.scenes).toEqual([{ text: "a" }]);
  expect(calls[0]).toEqual({ url: "/api/script", body: { url: "https://x.com/a", lang: "ar" } });
  expect(calls[1]).toEqual({ url: "/api/script", body: { topic: "العادات", lang: "en" } });
});

test("requestBackground: يرسل prompt ويعيد الرابط", async () => {
  const calls = mockFetch(() => ok({ url: "https://b/i.png", cached: true }));
  expect(await requestBackground("خلفية")).toEqual({ url: "https://b/i.png", cached: true });
  expect(calls[0].body).toEqual({ prompt: "خلفية" });
});

test("requestNarration: يرسل النص والصوت", async () => {
  const data = { audioUrl: "u", captions: [], durationSec: 3, cached: false };
  const calls = mockFetch(() => ok(data));
  expect(await requestNarration({ text: "نص", voiceId: "ar-SA-HamedNeural" })).toEqual(data);
  expect(calls[0]).toEqual({ url: "/api/tts", body: { text: "نص", voiceId: "ar-SA-HamedNeural" } });
});

test("رسالة خطأ الخادم تُرمى كما هي", async () => {
  mockFetch(() => Response.json({ type: "error", message: "الرصيد غير كافٍ" }, { status: 402 }));
  await expect(requestBackground("x")).rejects.toThrow("الرصيد غير كافٍ");
});

test("رد غير JSON أو بلا رسالة ⇒ رسالة احتياطية عربية", async () => {
  mockFetch(() => new Response("<html>502</html>", { status: 502 }));
  await expect(requestNarration({ text: "x", voiceId: "v" })).rejects.toThrow("فشل توليد الصوت");
  mockFetch(() => Response.json({ type: "error" }));
  await expect(requestScript({ source: "x", isUrl: false, lang: "ar" })).rejects.toThrow("فشل توليد السكربت");
});
