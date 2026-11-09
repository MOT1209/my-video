import { expect, test } from "bun:test";
import { createRender, ensureUser, finishRender, sandboxMsSince } from "./db/repository";
import { createTestDb } from "./db/testing";
import { checkRenderBudget, dailyBudgetMinutes } from "./render-budget";

const { db, client } = await createTestDb();

test("dailyBudgetMinutes: غير مضبوط أو غير صالح ⇒ null (معطّل)", () => {
  expect(dailyBudgetMinutes({})).toBeNull();
  expect(dailyBudgetMinutes({ RENDER_DAILY_SANDBOX_MINUTES: "" })).toBeNull();
  expect(dailyBudgetMinutes({ RENDER_DAILY_SANDBOX_MINUTES: "abc" })).toBeNull();
  expect(dailyBudgetMinutes({ RENDER_DAILY_SANDBOX_MINUTES: "0" })).toBeNull();
  expect(dailyBudgetMinutes({ RENDER_DAILY_SANDBOX_MINUTES: "-5" })).toBeNull();
  expect(dailyBudgetMinutes({ RENDER_DAILY_SANDBOX_MINUTES: " 90 " })).toBe(90);
});

async function renderWithMs(clerkId: string, ms: number, ageHours = 0) {
  const user = await ensureUser(db, { clerkId });
  const row = await createRender(db, {
    userId: user.id,
    compositionId: "ShortsComp",
    inputProps: { hook: clerkId },
  });
  await finishRender(db, row.id, { status: "done", url: "https://b/v.mp4", sizeBytes: 1, sandboxMs: ms });
  if (ageHours > 0) {
    await client.query(
      "update renders set created_at = now() - make_interval(hours => $2) where id = $1",
      [row.id, ageHours],
    );
  }
}

test("sandboxMsSince يجمع المنتهي ضمن النافذة ويتجاهل الأقدم", async () => {
  const before = await sandboxMsSince(db, new Date(Date.now() - 24 * 3600_000));
  await renderWithMs("budget-a", 60_000);
  await renderWithMs("budget-b", 120_000);
  await renderWithMs("budget-old", 999_000, 48);
  const after = await sandboxMsSince(db, new Date(Date.now() - 24 * 3600_000));
  expect(after - before).toBe(180_000);
});

test("checkRenderBudget: بلا حدّ يسمح دائماً، وبحدّ يرفض عند بلوغه", async () => {
  const unlimited = await checkRenderBudget(db, Date.now(), {});
  expect(unlimited).toEqual({ allowed: true, usedMinutes: 0, limitMinutes: null });

  const used = (await sandboxMsSince(db, new Date(Date.now() - 24 * 3600_000))) / 60_000;
  const under = await checkRenderBudget(db, Date.now(), {
    RENDER_DAILY_SANDBOX_MINUTES: String(used + 1),
  });
  expect(under.allowed).toBe(true);
  expect(under.limitMinutes).toBe(used + 1);

  const reached = await checkRenderBudget(db, Date.now(), {
    RENDER_DAILY_SANDBOX_MINUTES: String(used),
  });
  expect(reached.allowed).toBe(false);
  expect(reached.usedMinutes).toBeCloseTo(used, 5);
});
