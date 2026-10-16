import { expect, test } from "bun:test";
import { transcribeAudio, isSupportedAudioType, MAX_AUDIO_BYTES } from "./transcribe";

/** fetch وهمي يُسجّل الطلب ويُعيد رد Gemini الوهمي. */
function fakeFetch(reply: {
  status?: number;
  body?: unknown;
  text?: string;
}): { fetchImpl: (url: string, init?: RequestInit) => Promise<Response>; calls: string[]; bodies: string[] } {
  const calls: string[] = [];
  const bodies: string[] = [];
  return {
    calls,
    bodies,
    fetchImpl: async (url, init) => {
      calls.push(url);
      bodies.push(String(init?.body ?? ""));
      return new Response(reply.text ?? JSON.stringify(reply.body ?? {}), {
        status: reply.status ?? 200,
      });
    },
  };
}

const AUDIO = new Uint8Array([1, 2, 3, 4]);

function withKey(value: string | undefined, fn: () => Promise<void>) {
  const saved = process.env.GEMINI_API_KEY;
  if (value === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = value;
  }
  return fn().finally(() => {
    if (saved === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = saved;
    }
  });
}

test("أنواع الصوت المدعومة تُقبل مع معاملات codecs", () => {
  expect(isSupportedAudioType("audio/mpeg")).toBe(true);
  expect(isSupportedAudioType("audio/mp4; codecs=mp4a.40.2")).toBe(true);
  expect(isSupportedAudioType("audio/MP3")).toBe(true);
  expect(isSupportedAudioType("video/mp4")).toBe(false);
  expect(isSupportedAudioType("")).toBe(false);
});

test("النسخ يُرسل الصوت مضمَّناً base64 ويُعيد النص مع كابشن موزَّع", async () => {
  await withKey("key-123", async () => {
    const { fetchImpl, calls, bodies } = fakeFetch({
      body: {
        candidates: [
          { content: { parts: [{ text: "مرحباً بكم" }, { text: "في هذا الفيديو" }] } },
        ],
      },
    });

    const result = await transcribeAudio(
      { audio: AUDIO, mimeType: "audio/mpeg", lang: "ar", durationSec: 4 },
      fetchImpl,
    );

    expect(calls[0]).toContain("generateContent?key=key-123");
    expect(calls[0]).toContain("gemini-2.0-flash");
    const sent = JSON.parse(bodies[0]) as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    };
    const inline = sent.contents[0].parts[1] as { inlineData: { mimeType: string; data: string } };
    expect(inline.inlineData.mimeType).toBe("audio/mpeg");
    expect(Buffer.from(inline.inlineData.data, "base64")).toEqual(Buffer.from(AUDIO));

    // الأجزاء المتعددة تُجمع في نص واحد
    expect(result.text).toBe("مرحباً بكم في هذا الفيديو");
    // 5 كلمات على 4 ثوانٍ ⇒ 0.8 ثانية للكلمة، والكلمة الأخيرة تنتهي عند 4
    expect(result.captions).toHaveLength(5);
    expect(result.captions[0]).toMatchObject({ word: "مرحباً", start: 0, end: 0.8 });
    expect(result.captions[4]).toMatchObject({ word: "الفيديو", end: 4 });
  });
});

test("بلا مدة معروفة لا تُختلق كابشنات", async () => {
  await withKey("key-123", async () => {
    const { fetchImpl } = fakeFetch({
      body: { candidates: [{ content: { parts: [{ text: "نص" }] } }] },
    });
    const result = await transcribeAudio(
      { audio: AUDIO, mimeType: "audio/wav", lang: "en", durationSec: null },
      fetchImpl,
    );
    expect(result.captions).toEqual([]);
    expect(result.text).toBe("نص");
  });
});

test("حراسات الإدخال: بلا مفتاح، صوت فارغ، حجم زائد، صيغة غير مدعومة، رد فاشل", async () => {
  await withKey(undefined, async () => {
    const { fetchImpl } = fakeFetch({});
    await expect(
      transcribeAudio({ audio: AUDIO, mimeType: "audio/mpeg", lang: "ar" }, fetchImpl),
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });

  await withKey("key-123", async () => {
    const { fetchImpl } = fakeFetch({});
    await expect(
      transcribeAudio(
        { audio: new Uint8Array(), mimeType: "audio/mpeg", lang: "ar" },
        fetchImpl,
      ),
    ).rejects.toThrow(/فارغ/);

    await expect(
      transcribeAudio(
        {
          audio: new Uint8Array(MAX_AUDIO_BYTES + 1),
          mimeType: "audio/mpeg",
          lang: "ar",
        },
        fetchImpl,
      ),
    ).rejects.toThrow(/يتجاوز الحد/);

    await expect(
      transcribeAudio({ audio: AUDIO, mimeType: "video/mp4", lang: "ar" }, fetchImpl),
    ).rejects.toThrow(/غير مدعومة/);

    const failing = fakeFetch({ status: 429, text: "quota" });
    await expect(
      transcribeAudio(
        { audio: AUDIO, mimeType: "audio/mpeg", lang: "ar" },
        failing.fetchImpl,
      ),
    ).rejects.toThrow(/429/);

    const empty = fakeFetch({ body: { candidates: [{ content: { parts: [] } }] } });
    await expect(
      transcribeAudio(
        { audio: AUDIO, mimeType: "audio/mpeg", lang: "ar" },
        empty.fetchImpl,
      ),
    ).rejects.toThrow(/نصاً منطوقاً/);
  });
});
