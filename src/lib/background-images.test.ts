import { expect, mock, test } from "bun:test";

// محاكاة @vercel/blob قبل استيراد الكود المختبر — بلا شبكةAbsolutely
interface FakeBlobState {
  headResult: { url: string; size: number } | null;
  headError: Error | null;
  putCalls: Array<{ path: string; body: Blob; token?: string }>;
  putUrl: string;
}

const blobState: FakeBlobState = {
  headResult: null,
  headError: null,
  putCalls: [],
  putUrl: "https://blob/backgrounds/fake.png",
};

mock.module("@vercel/blob", () => ({
  BlobAccessError: class BlobAccessError extends Error {},
  get: async () => null,
  head: async (path: string, opts?: { token?: string }) => {
    void path;
    void opts;
    if (blobState.headError) {
      throw blobState.headError;
    }
    if (!blobState.headResult) {
      throw new Error("not found");
    }
    return blobState.headResult;
  },
  put: async (
    path: string,
    body: Blob,
    opts?: { token?: string },
  ) => {
    blobState.putCalls.push({ path, body, token: opts?.token });
    return { url: blobState.putUrl };
  },
}));

const {
  backgroundCachePath,
  buildImagePrompt,
  generateBackgroundImage,
} = await import("./background-images");

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "GEMINI_IMAGE_MODEL",
  "BLOB_READ_WRITE_TOKEN",
] as const;
const savedEnv = ENV_KEYS.map((k) => process.env[k]);

function setUp(): void {
  process.env.GEMINI_API_KEY = "fake-key";
  process.env.GEMINI_IMAGE_MODEL = "gemini-nano-banana-2.1";
  process.env.BLOB_READ_WRITE_TOKEN = "blob-tok";
  blobState.headResult = null;
  blobState.headError = null;
  blobState.putCalls = [];
}

function restore(): void {
  ENV_KEYS.forEach((k, i) => {
    const v = savedEnv[i];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  });
}

test("buildImagePrompt يزيل markdown ويضيف قاعدة 9:16", () => {
  const p = buildImagePrompt("**كتلة ## مهمة** عن الخليج");
  expect(p).toContain("عن الخليج");
  expect(p).not.toContain("#");
  expect(p).toContain("9:16");
  expect(p.length).toBeLessThanOrEqual(400);
});

test("backgroundCachePath حتمي ومختلف للمدخلات المختلفة", () => {
  expect(backgroundCachePath("m", "p")).toBe(backgroundCachePath("m", "p"));
  expect(backgroundCachePath("m", "p1")).not.toBe(
    backgroundCachePath("m", "p2"),
  );
  expect(backgroundCachePath("m1", "p")).not.toBe(
    backgroundCachePath("m2", "p"),
  );
});

test("بيئة ناقصة: خطأ واضح قبل أي شبكة", async () => {
  setUp();
  delete process.env.GEMINI_API_KEY;
  try {
    await expect(
      generateBackgroundImage({ prompt: "خلفية صحراوية" }, async () => {
        throw new Error("fetch must not be called");
      }),
    ).rejects.toThrow("GEMINI_API_KEY");
  } finally {
    restore();
  }
});

test("كاش ناجح: head يجد المسار → صفر استدعاءات توليد", async () => {
  setUp();
  const prompt = buildImagePrompt("صحراء ليلاً");
  blobState.headResult = { url: "https://blob/cache-hit.png", size: 1 };
  try {
    const result = await generateBackgroundImage(
      { prompt },
      async () => {
        throw new Error("fetch must not be called");
      },
    );
    expect(result.cached).toBe(true);
    expect(result.url).toBe("https://blob/cache-hit.png");
    expect(blobState.putCalls).toHaveLength(0);
  } finally {
    restore();
  }
});

test("توليد كامل: inlineData base64 → رفع مُسمّى حتمياً", async () => {
  setUp();
  const bytes = Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]);
  const asBytes = async (b: Blob): Promise<Buffer> =>
    Buffer.from(await b.arrayBuffer());
  const fetchImpl = (async (url: string) => {
    expect(String(url)).toContain("gemini-nano-banana-2.1:generateContent");
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: bytes.toString("base64") } }],
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;

  const prompt = buildImagePrompt("مدينة عند الغروب");
  const result = await generateBackgroundImage({ prompt }, fetchImpl);
  expect(result.cached).toBe(false);
  expect(result.url).toBe(blobState.putUrl);
  expect(blobState.putCalls).toHaveLength(1);
  expect(blobState.putCalls[0].path).toBe(backgroundCachePath("gemini-nano-banana-2.1", prompt));
  expect(await asBytes(blobState.putCalls[0].body)).toEqual(bytes);
});

test("رد بلا صورة: خطأ واضح", async () => {
  setUp();
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ candidates: [] }), { status: 200 })) as unknown as typeof fetch;
  await expect(
    generateBackgroundImage({ prompt: "خلفية" }, fetchImpl),
  ).rejects.toThrow("inlineData");
});

test("خطأ Gemini: يُسفص بالأسماء الحية دون الترس", async () => {
  setUp();
  const fetchImpl = (async () =>
    new Response("quota", { status: 429 })) as unknown as typeof fetch;
  await expect(
    generateBackgroundImage({ prompt: "خلفية" }, fetchImpl),
  ).rejects.toThrow("429");
});
