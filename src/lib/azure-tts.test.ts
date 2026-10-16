import { expect, test } from "bun:test";
import {
  isAzureConfigured,
  isAzureVoice,
  synthesizeAzure,
  azureToken,
} from "./azure-tts";

const ENV_KEYS = ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"] as const;
const savedEnv = ENV_KEYS.map((k) => process.env[k]);

function restoreEnv(): void {
  ENV_KEYS.forEach((k, i) => {
    const v = savedEnv[i];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  });
}

function azureEnv(): void {
  process.env.AZURE_SPEECH_KEY = "fake-key";
  process.env.AZURE_SPEECH_REGION = "eastus";
}

test("بلا مفاتيح: ‏isAzureConfigured = false و ‏azureToken = null بلا شبكة", async () => {
  ENV_KEYS.forEach((k) => delete process.env[k]);
  try {
    expect(isAzureConfigured()).toBe(false);
    expect(
      await azureToken((async () => {
        throw new Error("يجب ألا يُستدعى fetch");
      }) as unknown as typeof fetch),
    ).toBeNull();
  } finally {
    restoreEnv();
  }
});

test("isAzureVoice يتعرف على أصوات Neural فقط", () => {
  expect(isAzureVoice("ar-SA-ZariyahNeural")).toBe(true);
  expect(isAzureVoice("en-US-AvaNeural")).toBe(true);
  expect(isAzureVoice("horrid-voice")).toBe(false);
});

test("synthesizeAzure: مسار كامل (توكن + SSML → mp3) وكابشن منتظم", async () => {
  azureEnv();
  try {
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("issueToken")) {
        expect(init?.headers).toMatchObject({
          "Ocp-Apim-Subscription-Key": "fake-key",
        });
        return new Response("token-xyz", { status: 200 });
      }
      // نقطة TTS: تحقق الترويسات الصوتية
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/ssml+xml");
      expect(headers["X-Microsoft-OutputFormat"]).toBe(
        "audio-24khz-48kbitrate-mono-mp3",
      );
      expect(headers.Authorization).toBe("Bearer token-xyz");
      expect(String(init?.body)).toContain("ar-SA");
      expect(String(init?.body)).toContain("ZariyahNeural");
      // 6000 بايت ≈ ثانية واحدة عند 48kbps — تطابق التوزيع المنتظم
      return new Response(new ArrayBuffer(6000 * 3), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      });
    }) as typeof fetch;

    const result = await synthesizeAzure(
      "كلمة واحدة كلمة أخرى كلمة ثالثة",
      "ar-SA-ZariyahNeural",
      fetchImpl,
    );
    expect(result.audio.length).toBe(6000 * 3);
    expect(result.durationSec).toBeCloseTo(3, 5);
    expect(result.captions).toHaveLength(6);
    expect(result.captions[0].start).toBe(0);
    expect(result.captions[5].end).toBeCloseTo(3, 1);
  } finally {
    restoreEnv();
  }
});

test("synthesizeAzure: فشل توليد → خطأ واضح بالحالة", async () => {
  azureEnv();
  try {
    const fetchImpl = (async (url: string) => {
      const u = String(url);
      if (u.includes("issueToken")) {
        return new Response("tok", { status: 200 });
      }
      return new Response("bad request", { status: 400 });
    }) as typeof fetch;
    await expect(
      synthesizeAzure("نص", "ar-SA-HamedNeural", fetchImpl),
    ).rejects.toThrow("فشل Azure TTS (400)");
  } finally {
    restoreEnv();
  }
});

test("توكن فاشل → خطأ واضح", async () => {
  azureEnv();
  try {
    const fetchImpl = (async () =>
      new Response("no auth", { status: 401 })) as unknown as typeof fetch;
    await expect(
      synthesizeAzure("نص", "ar-SA-HamedNeural", fetchImpl),
    ).rejects.toThrow("فشل الحصول على توكن");
  } finally {
    restoreEnv();
  }
});
