import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { defaultShortProps } from "../../../types/shorts";
import { FREE_SIGNUP_CREDITS } from "../credits";
import {
  applyStripeCreditGrant,
  claimRetry,
  createRender,
  deleteProject,
  ensureUser,
  finishRender,
  getCredits,
  listProjects,
  listRenders,
  listRetryableRenders,
  MAX_RENDER_ATTEMPTS,
  reclaimStaleRunning,
  saveProject,
  spendCredits,
  usageSummary,
} from "./repository";
import { createTestDb } from "./testing";

/**
 * الاختبارات تعمل على **Postgres حقيقي** (PGlite = Postgres مُصرَّف إلى WASM)
 * تُطبَّق عليه نفس ملفات الترحيل المُولَّدة لـ Neon — فيُختبر المخطط
 * والاستعلامات فعلياً بلا مفاتيح ولا شبكة.
 */

const { db, client } = await createTestDb();

let unique = 0;
function nextClerkId(prefix: string): string {
  unique += 1;
  return `${prefix}-${unique}`;
}

test("المستخدم الجديد يأخذ كريدتات الترحيب ولا تُصفَّر عند إعادة الاستئناف", async () => {
  const clerkId = nextClerkId("signup");
  const created = await ensureUser(db, { clerkId, email: "a@example.com" });
  expect(created.credits).toBe(FREE_SIGNUP_CREDITS);
  expect(created.plan).toBe("free");

  const spent = await spendCredits(db, created.id, 1);
  expect(spent).toEqual({ ok: true, credits: FREE_SIGNUP_CREDITS - 1 });

  // استئناف المستخدم نفسه (كل طلب لاحق) لا يلمس الرصيد
  const resumed = await ensureUser(db, { clerkId, email: "other@example.com" });
  expect(resumed.id).toBe(created.id);
  expect(resumed.credits).toBe(FREE_SIGNUP_CREDITS - 1);
});

test("spendCredits يرفض الرصيد غير الكافي ولا يجعله سالباً", async () => {
  const user = await ensureUser(db, { clerkId: nextClerkId("poor") });
  expect((await spendCredits(db, user.id, FREE_SIGNUP_CREDITS)).ok).toBe(true);
  const denied = await spendCredits(db, user.id, 1);
  expect(denied.ok).toBe(false);
  expect(denied.credits).toBe(0);
  expect(await getCredits(db, user.id)).toBe(0);
});

test("خصمان متزامنان لا يستهلكان كريدتاً واحداً مرتين", async () => {
  const user = await ensureUser(db, { clerkId: nextClerkId("race") });
  // الرصيد 3، كل خصم يطلب 2 ⇒ واحد فقط ينجح ويبقى 1
  const results = await Promise.all([
    spendCredits(db, user.id, 2),
    spendCredits(db, user.id, 2),
  ]);
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(await getCredits(db, user.id)).toBe(1);
});

test("saveProject يُدرج ثم يُحدّث ولا يسمح بالكتابة على مشروع مستخدم آخر", async () => {
  const owner = await ensureUser(db, { clerkId: nextClerkId("owner") });
  const intruder = await ensureUser(db, { clerkId: nextClerkId("intruder") });

  const saved = await saveProject(db, {
    userId: owner.id,
    title: "مشروع أول",
    props: defaultShortProps,
  });
  expect(saved.id).toBeTruthy();

  const updated = await saveProject(db, {
    userId: owner.id,
    id: saved.id,
    title: "مشروع محدَّث",
    props: { ...defaultShortProps, hook: "خطاف جديد" },
  });
  expect(updated.id).toBe(saved.id);
  expect(updated.title).toBe("مشروع محدَّث");
  expect(updated.props.hook).toBe("خطاف جديد");

  await expect(
    saveProject(db, {
      userId: intruder.id,
      id: saved.id,
      title: "تسلّل",
      props: defaultShortProps,
    }),
  ).rejects.toThrow();

  expect(await listProjects(db, owner.id)).toHaveLength(1);
  expect(await listProjects(db, intruder.id)).toHaveLength(0);
  expect(await deleteProject(db, intruder.id, saved.id)).toBe(false);
  expect(await deleteProject(db, owner.id, saved.id)).toBe(true);
  expect(await listProjects(db, owner.id)).toHaveLength(0);
});

test("صف التصيير يُحدَّث بالنتيجة ويظهر في السجل", async () => {
  const user = await ensureUser(db, { clerkId: nextClerkId("render") });
  const row = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "خطاف" },
    cacheKey: "renders-cache/ShortsComp/abc.mp4",
    creditsUsed: 1,
  });
  expect(row.status).toBe("running");
  expect(row.attempts).toBe(1);

  await finishRender(db, row.id, {
    status: "done",
    url: "https://blob.example/abc.mp4",
    sizeBytes: 4096,
    sandboxMs: 31_000,
  });

  const history = await listRenders(db, user.id);
  expect(history).toHaveLength(1);
  expect(history[0].status).toBe("done");
  expect(history[0].url).toBe("https://blob.example/abc.mp4");
  expect(history[0].sandboxMs).toBe(31_000);
});

test("الطابور يُعيد فقط الفاشل ذا المدخلات، ويسجّل المحاولة مرة واحدة", async () => {
  const user = await ensureUser(db, { clerkId: nextClerkId("queue") });

  // فاشل بمدخلات محفوظة ⇒ قابل لإعادة المحاولة
  const retryable = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "أ" },
  });
  await finishRender(db, retryable.id, { status: "error", error: "sandbox died" });

  // فاشل بلا مدخلات ⇒ لا يمكن إعادة تصييره
  const noProps = await createRender(db, { userId: user.id, compositionId: "ShortsComp" });
  await finishRender(db, noProps.id, { status: "error", error: "no props" });

  // ناجح ⇒ لا يُعاد
  const done = await createRender(db, { userId: user.id, compositionId: "ShortsComp" });
  await finishRender(db, done.id, { status: "done", url: "https://blob.example/done.mp4" });

  const candidates = await listRetryableRenders(db);
  expect(candidates.map((c) => c.id)).toEqual([retryable.id]);

  const claimed = await claimRetry(db, retryable.id);
  expect(claimed?.status).toBe("queued");
  expect(claimed?.attempts).toBe(2);
  // محاولة ثانية على الصف نفسه تفشل — لا تصيير مزدوج
  expect(await claimRetry(db, retryable.id)).toBeNull();

  // استنفاد المحاولات يُخرجه من الطابور
  await finishRender(db, retryable.id, { status: "error", error: "again" });
  for (let attempt = 2; attempt < MAX_RENDER_ATTEMPTS; attempt += 1) {
    const again = await claimRetry(db, retryable.id);
    expect(again).not.toBeNull();
    await finishRender(db, retryable.id, { status: "error", error: "again" });
  }
  expect(await listRetryableRenders(db)).toHaveLength(0);
});

test("الطابور يستعيد الصف المعلّق المهجور ولا يلمس الصف الحديث", async () => {
  const user = await ensureUser(db, { clerkId: nextClerkId("stale") });
  const parked = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "معلّق" },
  });
  await finishRender(db, parked.id, { status: "error", error: "died" });
  await claimRetry(db, parked.id);

  // حُجز الآن ⇒ لا يُعاد استرجاعه فوراً (لا تصيير مزدوج على صف طازج)
  const fresh = await listRetryableRenders(db);
  expect(fresh.map((r) => r.id)).not.toContain(parked.id);

  // بعد انتهاء مهلة الدالة صار مهجوراً ⇒ يُسترجَع لإعادة المحاولة
  await client.query(
    "update renders set updated_at = now() - interval '20 minutes' where id = $1",
    [parked.id],
  );
  const stale = await listRetryableRenders(db);
  expect(stale.map((r) => r.id)).toContain(parked.id);
  expect(await claimRetry(db, parked.id, "queued")).not.toBeNull();
});

test("صف running مهجور يُعلَن فاشلاً ويُرجع كريدته", async () => {
  const user = await ensureUser(db, { clerkId: nextClerkId("ghost") });
  const ghost = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "مات" },
    creditsUsed: 1,
  });
  const live = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "حي" },
  });

  await client.query(
    "update renders set updated_at = now() - interval '20 minutes' where id = $1",
    [ghost.id],
  );

  const reclaimed = await reclaimStaleRunning(db);
  expect(reclaimed.map((r) => r.id)).toEqual([ghost.id]);
  // النداء نفسه لا يُعيد صفاً ثانياً (انتقل إلى error)
  expect(await reclaimStaleRunning(db)).toHaveLength(0);

  const rows = await listRenders(db, user.id);
  expect(rows.find((r) => r.id === ghost.id)?.status).toBe("error");
  expect(rows.find((r) => r.id === live.id)?.status).toBe("running");
});

test("تلقيت Stripe يُطبَّق مرة واحدة ويُسجَّل كاستهلاك شراء", async () => {
  const user = await ensureUser(db, { clerkId: nextClerkId("buyer") });
  const before = await getCredits(db, user.id);
  const event = randomUUID();

  const first = await applyStripeCreditGrant(db, {
    eventId: event,
    type: "checkout.session.completed",
    userId: user.id,
    credits: 30,
  });
  expect(first).toEqual({ applied: true, duplicate: false, credits: before + 30 });

  // إعادة إرسال نفس الحدث (Stripe تعيد عند أي رد غير 2xx) ⇒ لا تلقيت ثانٍ
  const replay = await applyStripeCreditGrant(db, {
    eventId: event,
    type: "checkout.session.completed",
    userId: user.id,
    credits: 30,
  });
  expect(replay.applied).toBe(false);
  expect(replay.duplicate).toBe(true);
  expect(await getCredits(db, user.id)).toBe(before + 30);

  const summary = await usageSummary(db, user.id);
  expect(summary).toContainEqual({ kind: "purchase", units: 30 });
});

test("تلقيت لمستخدم غير موجود يفشل بلا ترك حجز معلّق (ذرّة الجملة الواحدة)", async () => {
  const event = randomUUID();
  await expect(
    applyStripeCreditGrant(db, {
      eventId: event,
      type: "checkout.session.completed",
      userId: randomUUID(),
      credits: 10,
    }),
  ).rejects.toThrow();

  // صفر صفوف معلّقة ⇒ إعادة إرسال الحدث نفسه يمكن أن تُطبَّق لاحقاً
  const result = await client.query<{ count: number }>(
    "select count(*)::int as count from stripe_events where id = $1",
    [event],
  );
  expect(result.rows[0].count).toBe(0);
});
