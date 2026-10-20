import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_MIGRATION_FILES, applyMigrationFile, createTestDb } from "./testing";

/**
 * الترحيلات على Postgres حقيقي (PGlite): من الصفر، وترقية من مخطط قائم
 * ببيانات قديمة، واتّساق ملفات drizzle-kit (journal ↔ SQL).
 */

const DRIZZLE_DIR = join(import.meta.dir, "..", "..", "..", "drizzle");

test("journal يطابق ملفات SQL بالترتيب (لا ترحيل يتيم ولا مفقود)", () => {
  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  expect(journal.entries.map((e) => `${e.tag}.sql`)).toEqual([...ALL_MIGRATION_FILES]);
  journal.entries.forEach((entry, i) => expect(entry.idx).toBe(i));
});

test("ترحيل من قاعدة فارغة ينشئ كل القيود والفهارس المطلوبة", async () => {
  const { query } = await createTestDb();
  const constraints = await query<{ conname: string }>(
    "select conname from pg_constraint where connamespace = 'public'::regnamespace",
  );
  const names = constraints.rows.map((r) => r.conname);
  for (const expected of [
    "users_clerk_id_unique",
    "stripe_events_pkey",
    "stripe_events_checkout_session_id_unique",
    "renders_user_id_users_id_fk",
    "projects_user_id_users_id_fk",
    "usage_events_user_id_users_id_fk",
  ]) {
    expect(names).toContain(expected);
  }
  const indexes = await query<{ indexname: string; indexdef: string }>(
    "select indexname, indexdef from pg_indexes where schemaname = 'public'",
  );
  const active = indexes.rows.find((r) => r.indexname === "renders_active_user_cache_uq");
  expect(active?.indexdef).toMatch(/UNIQUE/);
  expect(active?.indexdef).toMatch(/WHERE/);
  for (const idx of ["projects_user_updated_idx", "renders_user_created_idx", "usage_user_at_idx"]) {
    expect(indexes.rows.map((r) => r.indexname)).toContain(idx);
  }
});

test("القيود تُفرض فعلاً: clerk_id فريد، صف نشط واحد لكل (مستخدم، ناتج)، جلسة دفع واحدة", async () => {
  const { query } = await createTestDb();
  const user = randomUUID();
  await query("insert into users (id, clerk_id) values ($1, 'dup')", [user]);
  await expect(query("insert into users (clerk_id) values ('dup')")).rejects.toThrow();

  await query(
    "insert into renders (user_id, composition_id, cache_key, status) values ($1, 'c', 'k', 'running')",
    [user],
  );
  await expect(
    query(
      "insert into renders (user_id, composition_id, cache_key, status) values ($1, 'c', 'k', 'queued')",
      [user],
    ),
  ).rejects.toThrow(/renders_active_user_cache_uq/);
  // الصفوف المنتهية لا تُقيَّد: نفس الناتج يمكن تصييره مجدداً لاحقاً
  await query(
    "insert into renders (user_id, composition_id, cache_key, status) values ($1, 'c', 'k', 'done'), ($1, 'c', 'k', 'error')",
    [user],
  );

  await query(
    "insert into stripe_events (id, type, checkout_session_id) values ('evt_1', 't', 'cs_1')",
  );
  await expect(
    query("insert into stripe_events (id, type, checkout_session_id) values ('evt_2', 't', 'cs_1')"),
  ).rejects.toThrow();
});

test("حذف المستخدم يحذف مشاريعه وتصييراته واستهلاكه، ويُبقي سجل Stripe بلا ربط", async () => {
  const { query } = await createTestDb();
  const user = randomUUID();
  await query("insert into users (id, clerk_id) values ($1, 'gone')", [user]);
  await query("insert into projects (user_id, title, props) values ($1, 't', '{}')", [user]);
  await query("insert into renders (user_id, composition_id) values ($1, 'c')", [user]);
  await query("insert into usage_events (user_id, kind) values ($1, 'render')", [user]);
  await query("insert into stripe_events (id, type, user_id) values ('evt_x', 't', $1)", [user]);

  await query("delete from users where id = $1", [user]);
  for (const table of ["projects", "renders", "usage_events"]) {
    const { rows } = await query<{ n: number }>(`select count(*)::int as n from ${table}`);
    expect(rows[0].n).toBe(0);
  }
  const { rows } = await query<{ user_id: string | null }>(
    "select user_id from stripe_events where id = 'evt_x'",
  );
  expect(rows[0].user_id).toBeNull();
});

test("ترقية من 0000 ببيانات قديمة: الصفوف الفاشلة المخصومة تُعلَّم «مُرجعة» ولا يُمس غيرها", async () => {
  const [first, ...rest] = ALL_MIGRATION_FILES;
  const { client, query } = await createTestDb({ migrations: [first] });
  const user = randomUUID();
  await query("insert into users (id, clerk_id, credits) values ($1, 'legacy', 5)", [user]);
  await query(
    `insert into renders (user_id, composition_id, status, credits_used, cache_key) values
       ($1, 'c', 'error', 1, 'a'),
       ($1, 'c', 'error', 0, 'b'),
       ($1, 'c', 'done', 1, 'c'),
       ($1, 'c', 'running', 1, 'd')`,
    [user],
  );
  await query("insert into stripe_events (id, type, credits) values ('evt_old', 't', 10)");

  for (const file of rest) {
    await applyMigrationFile(client, file);
  }

  const { rows } = await query<{ cache_key: string; refunded: boolean }>(
    "select cache_key, refunded_at is not null as refunded from renders order by cache_key",
  );
  expect(rows).toEqual([
    { cache_key: "a", refunded: true },
    { cache_key: "b", refunded: false },
    { cache_key: "c", refunded: false },
    { cache_key: "d", refunded: false },
  ]);
  // الرصيد لا يتغير بالترحيل، وسجل Stripe القديم يبقى (بلا جلسة)
  const credits = await query<{ credits: number }>("select credits from users where id = $1", [
    user,
  ]);
  expect(credits.rows[0].credits).toBe(5);
  const events = await query<{ checkout_session_id: string | null }>(
    "select checkout_session_id from stripe_events where id = 'evt_old'",
  );
  expect(events.rows[0].checkout_session_id).toBeNull();
});
