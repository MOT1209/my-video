import { expect, test } from "bun:test";
import type { RenderProgress } from "../app/api/render/helpers";
import { openBillingSession, type BillingSession } from "./billing-session";
import { FREE_SIGNUP_CREDITS } from "./credits";
import { getCredits, listRenders, usageSummary } from "./db/repository";
import { createTestDb } from "./db/testing";
import { resolveStaleRenders, retryFailedRenders } from "./render-recovery";
import {
  executeRenderJob,
  MAX_RENDER_BODY_BYTES,
  readJsonBody,
  type RenderJobOptions,
} from "./render-job";
import type { RunRenderOutcome } from "./render-runner";

/**
 * مسارات الفشل في دورة التصيير المدفوعة — على Postgres حقيقي (PGlite)
 * وبـ sandbox/Blob مزيّفين محقونين (لا شبكة ولا mock.module).
 */

const { db, client } = await createTestDb();

let seq = 0;
async function billingFor(): Promise<BillingSession> {
  seq += 1;
  const s = await openBillingSession(
    { clerkId: `job-${seq}`, email: null, authenticated: true },
    db,
  );
  if (!s) throw new Error("no billing");
  return s;
}

const OUTCOME: RunRenderOutcome = {
  url: "https://blob.example/out.mp4",
  size: 1234,
  reusedSandbox: false,
  sandboxWallSeconds: 7,
};

function job(
  billing: BillingSession | null,
  overrides: Partial<RenderJobOptions> = {},
): { options: RenderJobOptions; sent: RenderProgress[] } {
  seq += 1;
  const sent: RenderProgress[] = [];
  return {
    sent,
    options: {
      compositionId: "ShortsComp",
      inputProps: { hook: `h-${seq}` },
      cachePath: `renders-cache/ShortsComp/job-${seq}.mp4`,
      billing,
      send: async (m) => {
        sent.push(m);
      },
      findCached: async () => null,
      render: async () => OUTCOME,
      ...overrides,
    },
  };
}

const last = (sent: RenderProgress[]) => sent[sent.length - 1];

test("تصيير ناجح: خصم واحد، صف done بالرابط، والعميل يرى الرصيد الجديد", async () => {
  const billing = await billingFor();
  const { options, sent } = job(billing);
  expect(await executeRenderJob(options)).toEqual({ status: "rendered", url: OUTCOME.url });

  expect(await getCredits(db, billing.userId)).toBe(FREE_SIGNUP_CREDITS - 1);
  const [row] = await listRenders(db, billing.userId);
  expect(row).toMatchObject({ status: "done", url: OUTCOME.url, sizeBytes: 1234, refundedAt: null });
  expect(last(sent)).toMatchObject({ type: "done", cached: false, credits: FREE_SIGNUP_CREDITS - 1 });
});

test("نتيجة في الكاش: لا خصم ولا صف ولا sandbox", async () => {
  const billing = await billingFor();
  let rendered = false;
  const { options, sent } = job(billing, {
    findCached: async () => ({ url: "https://blob.example/cached.mp4", size: 9 }),
    render: async () => {
      rendered = true;
      return OUTCOME;
    },
  });
  expect((await executeRenderJob(options)).status).toBe("cached");
  expect(rendered).toBe(false);
  expect(await getCredits(db, billing.userId)).toBe(FREE_SIGNUP_CREDITS);
  expect(await listRenders(db, billing.userId)).toHaveLength(0);
  expect(last(sent)).toMatchObject({ type: "done", cached: true });
});

test("رصيد غير كافٍ: لا sandbox ولا صف", async () => {
  const billing = await billingFor();
  await client.query("update users set credits = 0 where id = $1", [billing.userId]);
  let rendered = false;
  const { options, sent } = job(billing, {
    render: async () => {
      rendered = true;
      return OUTCOME;
    },
  });
  expect((await executeRenderJob(options)).status).toBe("insufficient");
  expect(rendered).toBe(false);
  expect(await listRenders(db, billing.userId)).toHaveLength(0);
  expect(last(sent)).toMatchObject({ type: "error" });
});

for (const [name, failure] of [
  ["فشل الـ sandbox", new Error("Sandbox crashed")],
  ["فشل رفع Blob", new Error("Vercel Blob: upload failed (503)")],
  ["انتهاء المهلة", new Error("Timed out after 300000ms")],
] as const) {
  test(`${name} بعد الخصم ⇒ إرجاع مرة واحدة وصف error ورسالة بلا تفاصيل داخلية`, async () => {
    const billing = await billingFor();
    const { options, sent } = job(billing, {
      render: async () => {
        throw failure;
      },
    });
    expect(await executeRenderJob(options)).toEqual({ status: "failed", refunded: true });

    expect(await getCredits(db, billing.userId)).toBe(FREE_SIGNUP_CREDITS);
    const [row] = await listRenders(db, billing.userId);
    expect(row.status).toBe("error");
    expect(row.refundedAt).not.toBeNull();
    expect(await usageSummary(db, billing.userId)).toContainEqual({ kind: "render", units: 0 });
    expect(last(sent).type).toBe("error");
  });
}

test("طلبان متزامنان لنفس الفيديو: خصم واحد فقط، والثاني «قيد التصيير»", async () => {
  const billing = await billingFor();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = job(billing, {
    render: async () => {
      await gate;
      return OUTCOME;
    },
  });
  const second = job(billing, {
    cachePath: first.options.cachePath,
    inputProps: first.options.inputProps,
  });

  const running = executeRenderJob(first.options);
  // ننتظر حتى يُفتح صف الأول (running) قبل إطلاق الثاني
  while ((await listRenders(db, billing.userId)).length === 0) {
    await new Promise((r) => setTimeout(r, 5));
  }
  expect((await executeRenderJob(second.options)).status).toBe("duplicate");
  release();
  expect((await running).status).toBe("rendered");

  expect(await getCredits(db, billing.userId)).toBe(FREE_SIGNUP_CREDITS - 1);
  expect(await listRenders(db, billing.userId)).toHaveLength(1);
});

test("فشل بعد الرفع (إرسال done للعميل يرمي): لا إرجاع لتصيير ناجح", async () => {
  const billing = await billingFor();
  const { options } = job(billing, {
    send: async (m) => {
      if (m.type === "done") throw new Error("client stream closed");
    },
  });
  await executeRenderJob(options);
  expect(await getCredits(db, billing.userId)).toBe(FREE_SIGNUP_CREDITS - 1);
  const [row] = await listRenders(db, billing.userId);
  expect(row).toMatchObject({ status: "done", url: OUTCOME.url, refundedAt: null });
});

test("الرفع نجح ثم تعذّرت كتابة done: الطابور يحسم الصف ناجحاً من الكاش بلا إرجاع", async () => {
  const billing = await billingFor();
  // جلسة فوترة تفشل كتابتها الختامية (قاعدة متقطعة لحظة الإغلاق)
  const flaky: BillingSession = { ...billing, finishRender: async () => false };
  const { options } = job(flaky);
  expect((await executeRenderJob(options)).status).toBe("rendered");
  let [row] = await listRenders(db, billing.userId);
  expect(row.status).toBe("running");

  await client.query("update renders set updated_at = now() - interval '20 minutes' where id = $1", [
    row.id,
  ]);
  const resolution = await resolveStaleRenders(db, async (path) =>
    path === options.cachePath ? { url: OUTCOME.url, size: OUTCOME.size } : null,
  );
  expect(resolution).toMatchObject({ recoveredDone: 1, refundedCredits: 0 });
  [row] = await listRenders(db, billing.userId);
  expect(row).toMatchObject({ status: "done", url: OUTCOME.url, refundedAt: null });
  expect(await getCredits(db, billing.userId)).toBe(FREE_SIGNUP_CREDITS - 1);
});

test("تعذّر الإرجاع لحظة الفشل: الصف يبقى running ثم يُرجعه الطابور مرة واحدة", async () => {
  const billing = await billingFor();
  const offline: BillingSession = { ...billing, refund: async () => false };
  const { options } = job(offline, {
    render: async () => {
      throw new Error("Sandbox crashed");
    },
  });
  expect(await executeRenderJob(options)).toEqual({ status: "failed", refunded: false });
  let [row] = await listRenders(db, billing.userId);
  expect(row.status).toBe("running");
  expect(await getCredits(db, billing.userId)).toBe(FREE_SIGNUP_CREDITS - 1);

  await client.query("update renders set updated_at = now() - interval '20 minutes' where id = $1", [
    row.id,
  ]);
  const noCache = async () => null;
  expect((await resolveStaleRenders(db, noCache)).refundedCredits).toBe(1);
  // تشغيل ثانٍ للطابور (أو تشغيلان متزامنان) لا يُرجع مرة أخرى
  expect((await resolveStaleRenders(db, noCache)).refundedCredits).toBe(0);
  [row] = await listRenders(db, billing.userId);
  expect(row.status).toBe("error");
  expect(row.refundedAt).not.toBeNull();
  expect(await getCredits(db, billing.userId)).toBe(FREE_SIGNUP_CREDITS);
});

test("إعادة المحاولة: حد المحاولات، لا خصم إضافي، والصف المكتمل لا يُعاد", async () => {
  const billing = await billingFor();
  const { options } = job(billing, {
    render: async () => {
      throw new Error("Sandbox crashed");
    },
  });
  await executeRenderJob(options);
  const creditsAfterRefund = await getCredits(db, billing.userId);

  let calls = 0;
  const failing = {
    findCached: async () => null,
    render: async ({ blobPath }: { blobPath: string }) => {
      // القاعدة مشتركة بين اختبارات الملف: نعدّ محاولات صف هذا الاختبار فقط
      if (blobPath === options.cachePath) calls += 1;
      throw new Error("Sandbox crashed");
    },
  };
  // attempts يبدأ 1 ⇒ محاولتان إضافيتان فقط (MAX_RENDER_ATTEMPTS = 3)
  for (let i = 0; i < 5; i += 1) {
    await retryFailedRenders(db, failing);
  }
  expect(calls).toBe(2);
  const [row] = await listRenders(db, billing.userId);
  expect(row).toMatchObject({ status: "error", attempts: 3 });
  expect(await getCredits(db, billing.userId)).toBe(creditsAfterRefund);
});

test("إعادة محاولة مكررة بالتوازي: محاولة واحدة فقط تحجز الصف", async () => {
  const billing = await billingFor();
  const { options } = job(billing, {
    render: async () => {
      throw new Error("Sandbox crashed");
    },
  });
  await executeRenderJob(options);

  let calls = 0;
  const [mine] = await listRenders(db, billing.userId);
  const deps = {
    findCached: async () => null,
    render: async ({ blobPath }: { blobPath: string }) => {
      if (blobPath === options.cachePath) calls += 1;
      return OUTCOME;
    },
  };
  const [a, b] = await Promise.all([retryFailedRenders(db, deps), retryFailedRenders(db, deps)]);
  const statuses = [...a, ...b].filter((r) => r.id === mine.id).map((r) => r.status);
  expect(statuses.filter((s) => s === "done")).toHaveLength(1);
  expect(calls).toBe(1);
  const [row] = await listRenders(db, billing.userId);
  expect(row.status).toBe("done");
});

test("عامل إعادة محاولة متأخر لا يكتب فوق نتيجة محاولة أحدث (fencing)", async () => {
  const billing = await billingFor();
  const { options } = job(billing, {
    render: async () => {
      throw new Error("Sandbox crashed");
    },
  });
  await executeRenderJob(options);
  const [failed] = await listRenders(db, billing.userId);

  // العامل A يحجز ثم «يتجمّد»؛ يصبح الصف مهجوراً فيحجزه B وينجح
  const { claimRetry, finishRender } = await import("./db/repository");
  const a = await claimRetry(db, failed.id, "error");
  if (!a) throw new Error("claim A");
  await client.query("update renders set updated_at = now() - interval '20 minutes' where id = $1", [
    failed.id,
  ]);
  const b = await claimRetry(db, failed.id, "queued");
  if (!b) throw new Error("claim B");
  expect(
    await finishRender(db, failed.id, { status: "done", url: OUTCOME.url }, {
      from: ["queued"],
      attempts: b.attempts,
    }),
  ).toBe(true);
  // A يستيقظ ويحاول إعلان الفشل ⇒ يُتجاهل
  expect(
    await finishRender(db, failed.id, { status: "error", error: "stale" }, {
      from: ["queued"],
      attempts: a.attempts,
    }),
  ).toBe(false);
  const [row] = await listRenders(db, billing.userId);
  expect(row).toMatchObject({ status: "done", url: OUTCOME.url });
});

test("readJsonBody: حجم معلن/فعلي زائد ⇒ 413، JSON تالف ⇒ 400", async () => {
  const big = "x".repeat(MAX_RENDER_BODY_BYTES + 1);
  expect(
    await readJsonBody(
      new Request("http://x", {
        method: "POST",
        headers: { "content-length": String(MAX_RENDER_BODY_BYTES + 1) },
        body: "{}",
      }),
      MAX_RENDER_BODY_BYTES,
    ),
  ).toEqual({ ok: false, status: 413 });
  expect(
    await readJsonBody(
      new Request("http://x", { method: "POST", body: JSON.stringify({ big }) }),
      MAX_RENDER_BODY_BYTES,
    ),
  ).toEqual({ ok: false, status: 413 });
  expect(
    await readJsonBody(new Request("http://x", { method: "POST", body: "{nope" }), 1024),
  ).toEqual({ ok: false, status: 400 });
  expect(
    await readJsonBody(new Request("http://x", { method: "POST", body: '{"a":1}' }), 1024),
  ).toEqual({ ok: true, value: { a: 1 } });
});
