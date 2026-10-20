import { expect, test } from "bun:test";
import { FREE_SIGNUP_CREDITS } from "./credits";
import { openBillingSession, type BillingSession } from "./billing-session";
import { createTestDb } from "./db/testing";
import { ensureUser, getCredits, listRenders, listUsage, usageSummary } from "./db/repository";
import type { RequestUser } from "./auth";

const { db } = await createTestDb();

let unique = 0;
function nextUser(): RequestUser {
  unique += 1;
  return { clerkId: `billing-${unique}`, email: null, authenticated: true };
}

async function session(): Promise<BillingSession> {
  const opened = await openBillingSession(nextUser(), db);
  if (!opened) throw new Error("جلسة غير متوقعة");
  return opened;
}

let renderSeq = 0;
function renderArgs(hook = "خطاف") {
  renderSeq += 1;
  return {
    compositionId: "ShortsComp",
    inputProps: { hook },
    cacheKey: `renders-cache/ShortsComp/session-${renderSeq}.mp4`,
  };
}

test("بلا قاعدة بيانات تُعاد null — قرار الرفض في الإنتاج مسؤولية المسار", async () => {
  expect(await openBillingSession(nextUser(), null)).toBeNull();
});

test("الخصم يفتح صف التصيير ويُنقص الكريدت ويسجّل الاستهلاك معاً", async () => {
  const s = await session();
  const started = await s.startPaidRender(renderArgs());
  expect(started.status).toBe("started");
  if (started.status !== "started") return;
  expect(started.credits).toBe(FREE_SIGNUP_CREDITS - 1);
  expect(await getCredits(db, s.userId)).toBe(FREE_SIGNUP_CREDITS - 1);

  const rows = await listRenders(db, s.userId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: started.renderId, status: "running", creditsUsed: 1 });
  expect(rows[0].inputProps).toEqual({ hook: "خطاف" });

  const usage = await listUsage(db, s.userId);
  expect(usage).toHaveLength(1);
  expect(usage[0]).toMatchObject({ kind: "render", units: 1 });
  expect(usage[0].meta).toEqual({ renderId: started.renderId });
});

test("رصيد صفر ⇒ رفض بلا صف ولا استهلاك", async () => {
  const s = await session();
  for (let i = 0; i < FREE_SIGNUP_CREDITS; i += 1) {
    expect((await s.startPaidRender(renderArgs())).status).toBe("started");
  }
  expect(await s.startPaidRender(renderArgs())).toEqual({ status: "insufficient", credits: 0 });
  expect(await getCredits(db, s.userId)).toBe(0);
  expect(await listRenders(db, s.userId)).toHaveLength(FREE_SIGNUP_CREDITS);
  expect(await listUsage(db, s.userId)).toHaveLength(FREE_SIGNUP_CREDITS);
});

test("الإرجاع يقع مرة واحدة فقط مهما تكرّر النداء، ويُصفّر الاستهلاك الصافي", async () => {
  const s = await session();
  const started = await s.startPaidRender(renderArgs());
  if (started.status !== "started") throw new Error(started.status);

  expect(await s.refund(started.renderId)).toBe(true);
  expect(await s.refund(started.renderId)).toBe(true);
  expect(await getCredits(db, s.userId)).toBe(FREE_SIGNUP_CREDITS);
  expect(await usageSummary(db, s.userId)).toContainEqual({ kind: "render", units: 0 });

  // جلسة جديدة (عملية أخرى) لا تستطيع إرجاعه مرة ثانية
  const other = await openBillingSession({ clerkId: `billing-${unique}`, email: null, authenticated: true }, db);
  await other?.refund(started.renderId);
  expect(await getCredits(db, s.userId)).toBe(FREE_SIGNUP_CREDITS);
});

test("صف مكتمل لا يُرجع ولا يُكتب فوقه بفشل متأخر", async () => {
  const s = await session();
  const started = await s.startPaidRender(renderArgs());
  if (started.status !== "started") throw new Error(started.status);

  expect(
    await s.finishRender(started.renderId, {
      status: "done",
      url: "https://blob.example/xyz.mp4",
      sizeBytes: 2048,
      sandboxMs: 12_345,
      durationSec: 42,
    }),
  ).toBe(true);

  // معالج فشل متأخر: لا إرجاع، ولا إغلاق ثانٍ
  await s.refund(started.renderId);
  expect(await s.finishRender(started.renderId, { status: "error", error: "متأخر" })).toBe(false);

  expect(await getCredits(db, s.userId)).toBe(FREE_SIGNUP_CREDITS - 1);
  const rows = await listRenders(db, s.userId);
  expect(rows[0]).toMatchObject({
    status: "done",
    url: "https://blob.example/xyz.mp4",
    sizeBytes: 2048,
    sandboxMs: 12_345,
    durationSec: 42,
    refundedAt: null,
  });
});

test("الفوترة تعمل بلا مصادقة Clerk (الوضع المحلي) — الفرض مسؤولية الحارس", async () => {
  const local: RequestUser = {
    clerkId: "local-dev-user",
    email: null,
    authenticated: false,
  };
  const existing = await ensureUser(db, { clerkId: local.clerkId });
  const s = await openBillingSession(local, db);
  expect(s?.userId).toBe(existing.id);
});
