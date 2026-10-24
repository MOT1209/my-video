import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Db } from "./client";
import {
  applyStripeCreditGrant,
  claimRetry,
  ensureUser,
  getCredits,
  refundRender,
  startChargedRender,
} from "./repository";
import * as schema from "./schema";
import { ALL_MIGRATION_FILES } from "./testing";

/**
 * تزامن حقيقي على PostgreSQL فعلي (اتصالات متعددة في Pool).
 * PGlite اتصال واحد يُسلسل الاستعلامات، فلا يُثبت غياب السباقات — هذا
 * الملف يفعل: كل `Promise.all` هنا يذهب لاتصالات منفصلة متوازية.
 *
 * يعمل فقط مع `TEST_DATABASE_URL` يشير إلى قاعدة **مؤقتة** اسمها يحوي
 * "test" — لأنه يحذف المخطط `public` ويعيد بناءه من ملفات الترحيل.
 * في CI: خدمة postgres:16 مخصّصة للمهمة. بدونه يُتخطّى الملف.
 */

const url = process.env.TEST_DATABASE_URL;
const dbName = url ? new URL(url).pathname.replace(/^\//, "") : "";
const enabled = Boolean(url) && /test/i.test(dbName);

const BREAKPOINT = "--> statement-breakpoint";
const CONCURRENCY = 12;

describe.skipIf(!enabled)("PostgreSQL حقيقي — ضمانات التزامن", () => {
  let pool: Pool;
  let db: Db;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: CONCURRENCY + 4 });
    await pool.query("drop schema if exists public cascade; create schema public;");
    for (const file of ALL_MIGRATION_FILES) {
      const sql = readFileSync(join(import.meta.dir, "..", "..", "..", "drizzle", file), "utf8");
      for (const statement of sql.split(BREAKPOINT)) {
        if (statement.trim()) await pool.query(statement);
      }
    }
    db = drizzle(pool, { schema }) as unknown as Db;
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function userWith(credits: number) {
    const user = await ensureUser(db, { clerkId: `pg-${randomUUID()}` });
    await pool.query("update users set credits = $1 where id = $2", [credits, user.id]);
    return user;
  }

  const many = <T>(fn: (i: number) => Promise<T>) =>
    Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => fn(i)));

  test("خصومات متزامنة لا تتجاوز الرصيد ولا تجعله سالباً", async () => {
    const user = await userWith(3);
    const results = await many((i) =>
      startChargedRender(db, {
        userId: user.id,
        cost: 1,
        compositionId: "ShortsComp",
        inputProps: { i },
        cacheKey: `k-${user.id}-${i}`,
      }),
    );
    expect(results.filter((r) => r.status === "started")).toHaveLength(3);
    expect(results.filter((r) => r.status === "insufficient")).toHaveLength(CONCURRENCY - 3);
    expect(await getCredits(db, user.id)).toBe(0);
    const usage = await pool.query("select count(*)::int as n from usage_events where user_id = $1", [
      user.id,
    ]);
    expect(usage.rows[0].n).toBe(3);
  });

  test("طلبات متزامنة لنفس الفيديو: خصم واحد وصف واحد", async () => {
    const user = await userWith(50);
    const results = await many(() =>
      startChargedRender(db, {
        userId: user.id,
        cost: 1,
        compositionId: "ShortsComp",
        inputProps: { same: true },
        cacheKey: `same-${user.id}`,
      }),
    );
    expect(results.filter((r) => r.status === "started")).toHaveLength(1);
    expect(results.filter((r) => r.status === "duplicate")).toHaveLength(CONCURRENCY - 1);
    expect(await getCredits(db, user.id)).toBe(49);
    const rows = await pool.query("select count(*)::int as n from renders where user_id = $1", [user.id]);
    expect(rows.rows[0].n).toBe(1);
  });

  test("إرجاعات متزامنة لنفس الصف تُطبَّق مرة واحدة", async () => {
    const user = await userWith(1);
    const started = await startChargedRender(db, {
      userId: user.id,
      cost: 1,
      compositionId: "ShortsComp",
      inputProps: {},
      cacheKey: `refund-${user.id}`,
    });
    if (started.status !== "started") throw new Error(started.status);
    const results = await many(() => refundRender(db, started.renderId));
    expect(results.filter((r) => r.refunded)).toHaveLength(1);
    expect(await getCredits(db, user.id)).toBe(1);
  });

  test("إرجاع متزامن مع إغلاق ناجح: لا يُرجع صف أُغلق done قبله", async () => {
    const user = await userWith(1);
    const started = await startChargedRender(db, {
      userId: user.id,
      cost: 1,
      compositionId: "ShortsComp",
      inputProps: {},
      cacheKey: `race-${user.id}`,
    });
    if (started.status !== "started") throw new Error(started.status);
    await pool.query("update renders set status = 'done', url = 'https://x' where id = $1", [
      started.renderId,
    ]);
    const results = await many(() => refundRender(db, started.renderId));
    expect(results.every((r) => !r.refunded)).toBe(true);
    expect(await getCredits(db, user.id)).toBe(0);
  });

  test("ويب هوك مكرر بالتوازي (نفس الحدث) يمنح مرة واحدة", async () => {
    const user = await userWith(0);
    const eventId = `evt_${randomUUID()}`;
    const results = await many(() =>
      applyStripeCreditGrant(db, {
        eventId,
        type: "checkout.session.completed",
        userId: user.id,
        credits: 10,
        checkoutSessionId: `cs_${eventId}`,
      }),
    );
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(results.filter((r) => r.duplicate)).toHaveLength(CONCURRENCY - 1);
    expect(await getCredits(db, user.id)).toBe(10);
  });

  test("أحداث مختلفة لنفس جلسة الدفع بالتوازي تمنح مرة واحدة", async () => {
    const user = await userWith(0);
    const session = `cs_${randomUUID()}`;
    const results = await many((i) =>
      applyStripeCreditGrant(db, {
        eventId: `evt_${session}_${i}`,
        type:
          i % 2 ? "checkout.session.async_payment_succeeded" : "checkout.session.completed",
        userId: user.id,
        credits: 30,
        checkoutSessionId: session,
      }),
    );
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(await getCredits(db, user.id)).toBe(30);
  });

  test("حجز إعادة المحاولة بالتوازي: عامل واحد فقط", async () => {
    const user = await userWith(1);
    const started = await startChargedRender(db, {
      userId: user.id,
      cost: 1,
      compositionId: "ShortsComp",
      inputProps: {},
      cacheKey: `retry-${user.id}`,
    });
    if (started.status !== "started") throw new Error(started.status);
    await pool.query("update renders set status = 'error' where id = $1", [started.renderId]);
    const claims = await many(() => claimRetry(db, started.renderId, "error"));
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
});
