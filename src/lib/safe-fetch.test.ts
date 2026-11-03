import { describe, expect, test } from "bun:test";
import {
  assertPublicMediaUrls,
  assertPublicUrl,
  fetchPublicText,
  isBlockedAddress,
  type FetchLike,
  type LookupFn,
} from "./safe-fetch";

const publicLookup: LookupFn = async () => [
  { address: "93.184.215.14", family: 4 },
];
const lookupTo =
  (address: string): LookupFn =>
  async () => [{ address, family: address.includes(":") ? 6 : 4 }];

describe("isBlockedAddress", () => {
  test.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "fc00::abcd",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "64:ff9b::a9fe:a9fe",
    "not-an-ip",
  ])("يرفض %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  test.each(["93.184.215.14", "8.8.8.8", "172.32.0.1", "2606:4700::1111"])(
    "يقبل العنوان العام %s",
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    },
  );
});

describe("assertPublicUrl", () => {
  test.each([
    "file:///etc/passwd",
    "ftp://example.com/",
    "http://localhost/",
    "http://app.localhost/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://user:pass@example.com/",
    "http://example.com:8080/",
    "not a url",
  ])("يرفض %s", async (url) => {
    await expect(assertPublicUrl(url, publicLookup)).rejects.toThrow();
  });

  test("يرفض مضيفاً يُحلّ إلى عنوان داخلي", async () => {
    await expect(
      assertPublicUrl("https://internal.example.com/", lookupTo("10.0.0.5")),
    ).rejects.toThrow();
  });

  test("يرفض إن كان أي عنوان من عناوين المضيف داخلياً", async () => {
    const mixed: LookupFn = async () => [
      { address: "93.184.215.14", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    await expect(
      assertPublicUrl("https://example.com/", mixed),
    ).rejects.toThrow();
  });

  test("يقبل رابطاً عاماً", async () => {
    const url = await assertPublicUrl(
      "https://example.com/a?b=1",
      publicLookup,
    );
    expect(url.hostname).toBe("example.com");
  });
});

describe("fetchPublicText", () => {
  test("يجلب صفحة HTML عامة بلا تتبع تلقائي لإعادة التوجيه", async () => {
    const inits: Array<RequestInit | undefined> = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      inits.push(init);
      return new Response("<p>مرحبا</p>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    };
    const text = await fetchPublicText("https://example.com/", {
      fetchImpl,
      lookup: publicLookup,
    });
    expect(text).toBe("<p>مرحبا</p>");
    expect(inits[0]?.redirect).toBe("manual");
    expect(inits[0]?.signal).toBeDefined();
  });

  test("يرفض إعادة توجيه إلى عنوان داخلي", async () => {
    const lookup: LookupFn = async (host) =>
      host === "evil.example.com"
        ? [{ address: "169.254.169.254", family: 4 }]
        : [{ address: "93.184.215.14", family: 4 }];
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      return new Response(null, {
        status: 302,
        headers: { location: "http://evil.example.com/latest/meta-data/" },
      });
    };
    await expect(
      fetchPublicText("https://example.com/", { fetchImpl, lookup }),
    ).rejects.toThrow();
    // الطلب الداخلي لم يُرسل أبداً
    expect(calls).toEqual(["https://example.com/"]);
  });

  test("يتوقف بعد حد إعادة التوجيه", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(null, { status: 301, headers: { location: "/again" } });
    await expect(
      fetchPublicText("https://example.com/", {
        fetchImpl,
        lookup: publicLookup,
        maxRedirects: 2,
      }),
    ).rejects.toThrow();
  });

  test("يرفض الرد الأكبر من الحد", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("x".repeat(5000), {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    await expect(
      fetchPublicText("https://example.com/", {
        fetchImpl,
        lookup: publicLookup,
        maxBytes: 1000,
      }),
    ).rejects.toThrow("أكبر من المسموح");
  });

  test("يرفض محتوى غير نصي", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("binary", {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    await expect(
      fetchPublicText("https://example.com/", {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toThrow();
  });

  test("رسالة الفشل لا تكشف رمز الحالة", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("no", { status: 401 });
    const err = await fetchPublicText("https://example.com/", {
      fetchImpl,
      lookup: publicLookup,
    }).catch((e: Error) => e);
    expect((err as Error).message).not.toContain("401");
  });
});

describe("assertPublicMediaUrls", () => {
  test("يقبل روابط وسائط عامة ويتجاهل الفارغة", async () => {
    await expect(
      assertPublicMediaUrls(
        ["https://cdn.example.com/a.png", null, undefined, "https://cdn.example.com/a.png"],
        publicLookup,
      ),
    ).resolves.toBeUndefined();
  });

  test("يرفض إن كان أي رابط وسائط يشير لعنوان داخلي", async () => {
    const lookup: LookupFn = async (host) =>
      host === "internal.example.com"
        ? [{ address: "10.0.0.8", family: 4 }]
        : [{ address: "93.184.215.14", family: 4 }];
    await expect(
      assertPublicMediaUrls(
        ["https://cdn.example.com/a.png", "http://internal.example.com/bg.mp4"],
        lookup,
      ),
    ).rejects.toThrow();
  });
});
