import { expect, test } from "bun:test";
import { createRender, ensureUser, finishRender, getCredits, listRenders, MAX_RENDER_ATTEMPTS } from "./db/repository";
import { createTestDb } from "./db/testing";
import { resolveStaleRenders, retryFailedRenders } from "./render-recovery";
import type { RunRenderOutcome } from "./render-runner";

/**
 * منطق الطابور على Postgres حقيقي (PGlite): حسم الصفوف المهجورة وإعادة
 * المحاولة، مع التركيز على المال: الكريدت يُرجَع مرة واحدة فقط ولا يُرجَع
 * تصيير ناجح.
 */

const { db, client } = await createTestDb();

let unique = 0;
async function newUser(prefix: string) {
  unique += 1;
  return ensureUser(db, { clerkId: `${prefix}-${unique}` });
}

async function ageRow(id: string) {
  await client.query(
    "update renders set updated_at = now() - interval '20 minutes' where id = $1",
    [id],
  );
}

async function statusOf(userId: string, id: string) {
  const rows = await listRenders(db, userId);
  return rows.find((r) => r.id === id);
}

const noCache = async () => null;

test("صف مهجور بلا ناتج في الكاش: يُعلن فاشلاً ويُرجَع الكريدت مرة واحدة فقط", async () => {
  const user = await newUser("stale-refund");
  const before = await getCredits(db, user.id);
  const row = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "x" },
    cacheKey: "k-refund",
    creditsUsed: 1,
  });
  await ageRow(row.id);

  const first = await resolveStaleRenders(db, noCache);
  expect(first.reclaimed).toBeGreaterThanOrEqual(1);
  expect(first.refundedCredits).toBe(1);
  expect((await statusOf(user.id, row.id))?.status).toBe("error");
  expect(await getCredits(db, user.id)).toBe(before + 1);

  // تشغيل ثانٍ: الصف لم يعد running فلا إرجاع مزدوج
  const second = await resolveStaleRenders(db, noCache);
  expect(second.refundedCredits).toBe(0);
  expect(await getCredits(db, user.id)).toBe(before + 1);
});

test("صف مهجور وناتجه موجود في الكاش: يُغلق ناجحاً بلا إرجاع", async () => {
  const user = await newUser("stale-cached");
  const before = await getCredits(db, user.id);
  const row = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "y" },
    cacheKey: "k-cached",
    creditsUsed: 1,
  });
  await ageRow(row.id);

  const result = await resolveStaleRenders(db, async (key) =>
    key === "k-cached" ? { url: "https://blob.example/v.mp4", size: 123 } : null,
  );
  expect(result.recoveredDone).toBeGreaterThanOrEqual(1);
  const after = await statusOf(user.id, row.id);
  expect(after?.status).toBe("done");
  expect(after?.url).toBe("https://blob.example/v.mp4");
  expect(await getCredits(db, user.id)).toBe(before);
});

test("خطأ في فحص الكاش لصف واحد لا يوقف بقية الصفوف ويبقى الصف running", async () => {
  const user = await newUser("stale-throw");
  const bad = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "bad" },
    cacheKey: "k-bad",
    creditsUsed: 1,
  });
  await ageRow(bad.id);

  const originalError = console.error;
  console.error = () => {};
  try {
    await resolveStaleRenders(db, async () => {
      throw new Error("blob down");
    });
  } finally {
    console.error = originalError;
  }
  expect((await statusOf(user.id, bad.id))?.status).toBe("running");
});

test("إعادة المحاولة: فشل بنية ثم نجاح يغلق الصف done ويستدعي التصيير بمدخلاته", async () => {
  const user = await newUser("retry-ok");
  const row = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "retry" },
    cacheKey: "k-retry",
  });
  await finishRender(db, row.id, { status: "error", error: "sandbox stopped", retryable: true });

  const calls: Array<{ compositionId: string; userId: string }> = [];
  const outcome: RunRenderOutcome = {
    url: "https://blob.example/r.mp4",
    size: 456,
    reusedSandbox: false,
    sandboxWallSeconds: 2,
  };
  const results = await retryFailedRenders(db, {
    findCached: noCache,
    render: async (args) => {
      calls.push({ compositionId: args.compositionId, userId: args.userId });
      return outcome;
    },
  });
  const mine = results.find((r) => r.id === row.id);
  expect(mine).toEqual({ id: row.id, status: "done", cached: false });
  expect(calls).toContainEqual({ compositionId: "ShortsComp", userId: user.id });
  const after = await statusOf(user.id, row.id);
  expect(after?.status).toBe("done");
  expect(after?.url).toBe(outcome.url);
});

test("إعادة المحاولة تستعمل الكاش أولاً ولا تستدعي التصيير", async () => {
  const user = await newUser("retry-cached");
  const row = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "cached" },
    cacheKey: "k-retry-cached",
  });
  await finishRender(db, row.id, { status: "error", error: "x", retryable: true });

  let rendered = false;
  const results = await retryFailedRenders(db, {
    findCached: async () => ({ url: "https://blob.example/c.mp4", size: 9 }),
    render: async () => {
      rendered = true;
      throw new Error("لا يجب الاستدعاء");
    },
  });
  expect(results.find((r) => r.id === row.id)).toEqual({ id: row.id, status: "done", cached: true });
  expect(rendered).toBe(false);
});

test("فشل إعادة المحاولة يُسجَّل برسالة آمنة بلا تسريب نص الخطأ الخام", async () => {
  const user = await newUser("retry-fail");
  const row = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "fail" },
    cacheKey: "k-retry-fail",
  });
  await finishRender(db, row.id, { status: "error", error: "x", retryable: true });

  const originalError = console.error;
  console.error = () => {};
  let results;
  try {
    results = await retryFailedRenders(db, {
      findCached: noCache,
      render: async () => {
        throw new Error("secret internal /vercel/sandbox/path token=abc");
      },
    });
  } finally {
    console.error = originalError;
  }
  const mine = results.find((r) => r.id === row.id);
  expect(mine?.status).toBe("error");
  expect(mine?.error).not.toContain("token=abc");
  const after = await statusOf(user.id, row.id);
  expect(after?.status).toBe("error");
  expect(after?.error ?? "").not.toContain("token=abc");
  expect(MAX_RENDER_ATTEMPTS).toBeGreaterThan(1);
});
