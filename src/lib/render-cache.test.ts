import { expect, mock, test } from "bun:test";

// نبدّل وحدة @vercel/blob قبل استيراد الكود المُختبر حتى لا تلمس الشبكة
const fakeHead = mock(() => Promise.resolve({ url: "https://b/x.mp4", size: 123 }));

class FakeBlobNotFoundError extends Error {
  constructor() {
    super("The requested blob does not exist");
    this.name = "BlobNotFoundError";
  }
}

// نتجاهل معاملا head هنا، حفنا لا نقهّر الفحص على المعاملات
mock.module("@vercel/blob", () => ({
  BlobNotFoundError: FakeBlobNotFoundError,
  BlobAccessError: class BlobAccessError extends Error {},
  get: async () => null,
  head: () => fakeHead(),
}));

const { findCachedRender, RENDER_CACHE_PREFIX, renderCachePath, stableStringify } =
  await import("./render-cache");

test("stableStringify مستقلة عن ترتيب المفاتيح", () => {
  const a = stableStringify({ b: 2, a: 1, c: { z: "y", w: "x" } });
  const b = stableStringify({ c: { w: "x", z: "y" }, a: 1, b: 2 });
  expect(a).toBe(b);
});

test("stableStringify يتجاهل المفاتيح undefined و يحفظ ترتيب المصفوفات", () => {
  expect(stableStringify({ a: [3, 1, 2], gone: undefined })).toBe(stableStringify({ a: [3, 1, 2] }));
});

test("نفس المدخلات تعطي نفس مسار الكاش", () => {
  const props = { hook: "h", scenes: [{ id: "s1", text: "t" }] };
  expect(renderCachePath("ShortsComp", props)).toBe(renderCachePath("ShortsComp", props));
});

test("inputProps مختلفة تعطي مسارات مختلفة", () => {
  const p1 = renderCachePath("ShortsComp", { hook: "أ", sceneCount: 1 });
  const p2 = renderCachePath("ShortsComp", { hook: "ب", sceneCount: 1 });
  const p3 = renderCachePath("MyComp", { hook: "أ", sceneCount: 1 });
  expect(p1).not.toBe(p2);
  expect(p1).not.toBe(p3);
});

test("مسارات الكاش الخاصة تختلف حسب المستخدم ولا تكشف معرّفه", () => {
  const first = renderCachePath("ShortsComp", { x: 1 }, "clerk-user-a");
  const second = renderCachePath("ShortsComp", { x: 1 }, "clerk-user-b");
  expect(first).not.toBe(second);
  expect(first).not.toContain("clerk-user-a");
  expect(second).not.toContain("clerk-user-b");
});

test("صيغة المسار: prefix/compositionId/hash.mp4", () => {
  const path = renderCachePath("ShortsComp", { x: 1 });
  expect(path.startsWith(`${RENDER_CACHE_PREFIX}/ShortsComp/`)).toBe(true);
  expect(path.endsWith(".mp4")).toBe(true);
  expect(path.includes("/render")).toBe(false);
});

test("findCachedRender يعيد النتيجة عند وجودها", async () => {
  const result = await findCachedRender("renders-cache/x.mp4");
  expect(result).toEqual({ url: "https://b/x.mp4", size: 123 });
});

test("findCachedRender يعيد null عند عدم الوجود (BlobNotFoundError)", async () => {
  fakeHead.mockImplementation(() => Promise.reject(new FakeBlobNotFoundError()));
  expect(await findCachedRender("renders-cache/missing.mp4")).toBeNull();
});

test("findCachedRender لا يفرط في خطأ غير متوقع", async () => {
  fakeHead.mockImplementation(() => Promise.reject(new Error("boom")));
  expect(await findCachedRender("renders-cache/err.mp4")).toBeNull();
});
