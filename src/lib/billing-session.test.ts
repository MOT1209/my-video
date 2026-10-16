import { expect, test } from "bun:test";
import { FREE_SIGNUP_CREDITS } from "./credits";
import { openBillingSession } from "./billing-session";
import { createTestDb } from "./db/testing";
import { ensureUser, getCredits, listRenders, listUsage } from "./db/repository";
import type { RequestUser } from "./auth";

const { db } = await createTestDb();

let unique = 0;
function nextUser(): RequestUser {
  unique += 1;
  return { clerkId: `billing-${unique}`, email: null, authenticated: true };
}

test("الكاش ليس تصييراً: بلا قاعدة بيانات تُعطَّل الفوترة بدل كسر التصيير", async () => {
  expect(await openBillingSession(nextUser(), null)).toBeNull();
});

test("الخصم يُنقص الكريدت ويسجّل استهلاك تصيير", async () => {
  const user = nextUser();
  const session = await openBillingSession(user, db);
  expect(session).not.toBeNull();
  if (!session) return;

  const charged = await session.charge();
  expect(charged).toEqual({ ok: true, credits: FREE_SIGNUP_CREDITS - 1 });
  expect(await getCredits(db, session.userId)).toBe(FREE_SIGNUP_CREDITS - 1);

  const usage = await listUsage(db, session.userId);
  expect(usage).toHaveLength(1);
  expect(usage[0]).toMatchObject({ kind: "render", units: 1 });
});

test("رصيد صفر ⇒ الخصم يُرفض ولا يُسجَّل استهلاك", async () => {
  const user = nextUser();
  const session = await openBillingSession(user, db);
  if (!session) throw new Error("جلسة غير متوقعة");
  for (let i = 0; i < FREE_SIGNUP_CREDITS; i += 1) {
    expect((await session.charge()).ok).toBe(true);
  }
  expect((await session.charge()).ok).toBe(false);
  expect(await getCredits(db, session.userId)).toBe(0);
  expect(await listUsage(db, session.userId)).toHaveLength(FREE_SIGNUP_CREDITS);
});

test("إرجاع الكريدت يقع مرة واحدة فقط مهما تكرّر النداء", async () => {
  const user = nextUser();
  const session = await openBillingSession(user, db);
  if (!session) throw new Error("جلسة غير متوقعة");

  await session.charge();
  await session.refund();
  await session.refund();
  expect(await getCredits(db, session.userId)).toBe(FREE_SIGNUP_CREDITS);

  // إرجاع بلا خصم لا يمنح كريدتاً مجانياً
  const fresh = await openBillingSession(nextUser(), db);
  if (!fresh) throw new Error("جلسة غير متوقعة");
  await fresh.refund();
  expect(await getCredits(db, fresh.userId)).toBe(FREE_SIGNUP_CREDITS);
});

test("صف التصيير يُفتح بحالة جارية ويُغلق بالنتيجة", async () => {
  const user = nextUser();
  const session = await openBillingSession(user, db);
  if (!session) throw new Error("جلسة غير متوقعة");

  const renderId = await session.startRender({
    compositionId: "ShortsComp",
    inputProps: { hook: "خطاف" },
    cacheKey: "renders-cache/ShortsComp/xyz.mp4",
  });
  expect(renderId).toBeTruthy();

  let rows = await listRenders(db, session.userId);
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("running");
  expect(rows[0].inputProps).toEqual({ hook: "خطاف" });

  await session.finishRender(renderId, {
    status: "done",
    url: "https://blob.example/xyz.mp4",
    sizeBytes: 2048,
    sandboxMs: 12_345,
    durationSec: 42,
  });

  rows = await listRenders(db, session.userId);
  expect(rows[0]).toMatchObject({
    status: "done",
    url: "https://blob.example/xyz.mp4",
    sizeBytes: 2048,
    sandboxMs: 12_345,
    durationSec: 42,
  });

  // تسجيل النتيجة بلا معرّف (تعذّر فتح الصف) لا يرمي
  await session.finishRender(null, { status: "error", error: "x" });
});

test("الفوترة تعمل بلا مصادقة Clerk (الوضع المحلي) — الفرض مسؤولية الحارس", async () => {
  const local: RequestUser = {
    clerkId: "local-dev-user",
    email: null,
    authenticated: false,
  };
  const existing = await ensureUser(db, { clerkId: local.clerkId });
  const session = await openBillingSession(local, db);
  expect(session?.userId).toBe(existing.id);
});
