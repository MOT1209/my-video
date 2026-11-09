import { afterEach, expect, mock, test } from "bun:test";
import { resetDbForTests, setDbForTests } from "../../lib/db/client";
import { createRender, ensureUser } from "../../lib/db/repository";
import { createTestDb } from "../../lib/db/testing";
import { resetStripeForTests } from "../../lib/stripe";
import { resetUpstashRedisForTests } from "../../lib/upstash-redis";

/**
 * مسارات الحساب والمحتوى: /api/credits و/api/renders و/api/script.
 * نفس أسلوب routes.test.ts: Clerk مُحاكى وقاعدة PGlite حقيقية.
 */

let clerkUserId: string | null = null;
mock.module("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: clerkUserId, sessionClaims: { email: null } }),
}));

const ENV_KEYS = [
  "NODE_ENV",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "RATE_LIMIT_ALLOW_IN_MEMORY",
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "GEMINI_API_KEY",
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    Object.defineProperty(process.env, key, {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    });
    if (value === undefined) delete process.env[key];
  }
  resetDbForTests();
  resetStripeForTests();
  resetUpstashRedisForTests();
}

afterEach(() => {
  setEnv(saved as Record<string, string>);
  setDbForTests(null);
  clerkUserId = null;
});

const BASE_ENV = {
  NODE_ENV: "test",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x",
  CLERK_SECRET_KEY: "sk_test_x",
  DATABASE_URL: "postgres://injected-pglite",
  RATE_LIMIT_ALLOW_IN_MEMORY: "true",
} as const;

let ipSeq = 0;
function post(body: string, contentType = "application/json") {
  ipSeq += 1;
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": contentType, "x-forwarded-for": `10.9.0.${ipSeq}` },
    body,
  });
}

test("credits: الشكل المُعلن للواجهة، والفوترة معطّلة بلا مفتاح Stripe", async () => {
  const { db } = await createTestDb();
  const credits = await import("./credits/route");
  setEnv(BASE_ENV);
  setDbForTests(db);
  clerkUserId = "user_credits";

  const res = await credits.GET();
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    data: {
      credits: number;
      billingEnabled: boolean;
      renderCost: number;
      packs: Array<{ id: string; credits: number; price: string }>;
    };
  };
  expect(body.data.billingEnabled).toBe(false);
  expect(body.data.renderCost).toBeGreaterThan(0);
  expect(body.data.credits).toBeGreaterThanOrEqual(0);
  expect(body.data.packs.length).toBeGreaterThan(0);
  for (const pack of body.data.packs) {
    expect(pack.id).toBeTruthy();
    expect(pack.credits).toBeGreaterThan(0);
    expect(pack.price).toBeTruthy();
  }
}, 60_000);

test("renders: حدّ limit يُتحقَّق منه، والسجل لكل مستخدم فقط", async () => {
  const { db } = await createTestDb();
  const renders = await import("./renders/route");
  setEnv(BASE_ENV);
  setDbForTests(db);

  const owner = await ensureUser(db, { clerkId: "user_hist_owner" });
  await ensureUser(db, { clerkId: "user_hist_other" });
  const row = await createRender(db, {
    userId: owner.id,
    compositionId: "ShortsComp",
    inputProps: { hook: "سجل" },
  });

  const list = (limit?: string) =>
    renders.GET(new Request(`http://localhost/api/renders${limit ? `?limit=${limit}` : ""}`));

  clerkUserId = "user_hist_owner";
  const mine = (await (await list()).json()) as { data: { renders: Array<{ id: string }> } };
  expect(mine.data.renders.map((r) => r.id)).toContain(row.id);

  clerkUserId = "user_hist_other";
  const theirs = (await (await list()).json()) as { data: { renders: unknown[] } };
  expect(theirs.data.renders).toHaveLength(0);

  for (const bad of ["0", "101", "abc", "1.5", "-3"]) {
    expect((await list(bad)).status).toBe(400);
  }
  expect((await list("100")).status).toBe(200);
}, 60_000);

test("script: صيغة غير JSON ⇒ 415، وطلب بلا رابط ولا موضوع ⇒ 400 قبل أي مزوّد", async () => {
  const script = await import("./script/route");
  setEnv({ ...BASE_ENV });
  const { db } = await createTestDb();
  setDbForTests(db);
  clerkUserId = "user_script";

  expect((await script.POST(post("x", "text/plain"))).status).toBe(415);
  expect((await script.POST(post(JSON.stringify({})))).status).toBe(400);
  expect((await script.POST(post(JSON.stringify({ topic: "ab" })))).status).toBe(400);
  expect((await script.POST(post(JSON.stringify({ url: "not-a-url" })))).status).toBe(400);
}, 60_000);
