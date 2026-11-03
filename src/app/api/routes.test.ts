import { afterEach, expect, mock, test } from "bun:test";
import Stripe from "stripe";
import { resetDbForTests, setDbForTests } from "../../lib/db/client";
import { createTestDb } from "../../lib/db/testing";
import { defaultShortProps } from "../../../types/shorts";
import { resetStripeForTests } from "../../lib/stripe";
import { resetUpstashRedisForTests } from "../../lib/upstash-redis";

/**
 * اختبارات على مستوى المسار (Request ← Response) لحرّاس الإنتاج:
 * هوية، تحقق، حدود، وفوترة مفقودة — كلها **قبل** أي sandbox أو مزوّد.
 *
 * Clerk مُحاكى: لا اختبار آخر يستورد `@clerk/nextjs/server` الحقيقي
 * (الاختبارات الأخرى تعمل بلا مفاتيح فلا تلمسه)، فتسرّب mock.module آمن هنا.
 */

let clerkUserId: string | null = null;
mock.module("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: clerkUserId, sessionClaims: { email: null } }),
}));

const ENV_KEYS = [
  "NODE_ENV",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "ALLOW_ANONYMOUS_PAID_ROUTES",
  "RATE_LIMIT_ALLOW_IN_MEMORY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET",
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
  clerkUserId = null;
});

const CLERK = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x",
  CLERK_SECRET_KEY: "sk_test_x",
};

let ipSeq = 0;
function post(body: string, headers: Record<string, string> = {}) {
  ipSeq += 1;
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ipSeq}`, ...headers },
    body,
  });
}

const validShort = {
  id: "ShortsComp",
  inputProps: {
    hook: "خطاف",
    scenes: [{ id: "s1", text: "مشهد" }],
  },
};

test("الإنتاج بلا Clerk: كل المسارات المكلفة تُغلق 503 قبل أي عمل", async () => {
  setEnv({ NODE_ENV: "production", BLOB_READ_WRITE_TOKEN: "tok" });
  const routes = await Promise.all([
    import("./render/route"),
    import("./script/route"),
    import("./image/route"),
    import("./tts/route"),
    import("./transcribe/route"),
  ]);
  for (const route of routes) {
    const res = await route.POST(post("{}"));
    expect(res.status).toBe(503);
  }
});

test("Clerk مفعّل والطلب غير مسجّل ⇒ 401", async () => {
  setEnv({ NODE_ENV: "production", ...CLERK, RATE_LIMIT_ALLOW_IN_MEMORY: "true" });
  const { POST } = await import("./render/route");
  expect((await POST(post(JSON.stringify(validShort)))).status).toBe(401);
});

test("مستخدم مسجّل في الإنتاج بلا DATABASE_URL ⇒ 503 (لا تصيير مجاني بصمت)", async () => {
  setEnv({
    NODE_ENV: "production",
    ...CLERK,
    RATE_LIMIT_ALLOW_IN_MEMORY: "true",
    BLOB_READ_WRITE_TOKEN: "tok",
  });
  clerkUserId = "user_paying";
  const { POST } = await import("./render/route");
  const res = await POST(post(JSON.stringify(validShort)));
  expect(res.status).toBe(503);
  expect(res.headers.get("content-type")).toContain("application/json");
});

test("الإنتاج بلا Upstash (ولا فتح صريح) ⇒ 503 حتى لمستخدم مسجّل", async () => {
  setEnv({ NODE_ENV: "production", ...CLERK, BLOB_READ_WRITE_TOKEN: "tok" });
  clerkUserId = "user_rl";
  const { POST } = await import("./render/route");
  expect((await POST(post(JSON.stringify(validShort)))).status).toBe(503);
});

test("تحقق مدخلات التصيير: JSON تالف، تكوين مجهول، رابط file:، حجم زائد", async () => {
  setEnv({
    NODE_ENV: "production",
    ...CLERK,
    RATE_LIMIT_ALLOW_IN_MEMORY: "true",
    BLOB_READ_WRITE_TOKEN: "tok",
  });
  const { POST } = await import("./render/route");
  const cases: Array<[string, Record<string, string>, number]> = [
    ["{not json", {}, 400],
    [JSON.stringify({ id: "EvilComp", inputProps: {} }), {}, 400],
    [
      JSON.stringify({
        ...validShort,
        inputProps: {
          ...validShort.inputProps,
          backgroundMedia: { type: "image", url: "file:///etc/passwd" },
        },
      }),
      {},
      400,
    ],
    ["{}", { "content-length": String(10 * 1024 * 1024) }, 413],
  ];
  for (const [i, [body, headers, status]] of cases.entries()) {
    clerkUserId = `user_validation_${i}`;
    const res = await POST(post(body, headers));
    const json = (await res.json()) as { type: string; message: string };
    expect(`${res.status} ${json.message}`).toStartWith(String(status));
    expect(json.type).toBe("error");
    // لا تفاصيل Zod/مسارات داخلية في الرسالة
    expect(json.message).not.toMatch(/ZodError|at \/|node_modules/);
  }
});

test("executeApi: JSON تالف أو مخالف للمخطط ⇒ 400 لا 500", async () => {
  setEnv({ NODE_ENV: "test" });
  const { POST } = await import("./script/route");
  expect((await POST(post("{oops"))).status).toBe(400);
  expect((await POST(post(JSON.stringify({ topic: "x" })))).status).toBe(400);
});

test("الشراء في الإنتاج يتطلب هوية حقيقية (لا كريدت مدفوع لحساب محلي مشترك)", async () => {
  setEnv({ NODE_ENV: "production", STRIPE_SECRET_KEY: "sk_test_fake" });
  const { POST } = await import("./billing/checkout/route");
  expect((await POST(post(JSON.stringify({ packId: "starter" })))).status).toBe(401);
});

const WEBHOOK_SECRET = "whsec_test_secret";

async function signedWebhook(event: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const header = await new Stripe("sk_test_fake").webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
  });
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": header },
    body: payload,
  });
}

const paidSession = {
  id: "evt_route_1",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_route_1",
      payment_status: "paid",
      amount_total: 500,
      currency: "usd",
      metadata: { clerkId: "user_1", packId: "starter", credits: "10" },
    },
  },
};

test("Webhook: بلا إعداد 503، بلا توقيع 400، توقيع خاطئ 400", async () => {
  const { POST } = await import("./billing/webhook/route");
  setEnv({ NODE_ENV: "production" });
  expect((await POST(await signedWebhook(paidSession))).status).toBe(503);

  setEnv({ NODE_ENV: "production", STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
  const unsigned = new Request("http://localhost/x", { method: "POST", body: "{}" });
  expect((await POST(unsigned)).status).toBe(400);
  expect((await POST(await signedWebhook(paidSession, "whsec_wrong"))).status).toBe(400);
  // حمولة عُدّلت بعد التوقيع
  const tampered = await signedWebhook(paidSession);
  const forged = new Request(tampered.url, {
    method: "POST",
    headers: tampered.headers,
    body: JSON.stringify({ ...paidSession, id: "evt_forged" }),
  });
  expect((await POST(forged)).status).toBe(400);
});

test("Webhook موقّع: غير مدفوع ⇒ 200 بلا منح؛ مدفوع والقاعدة غائبة ⇒ 503 لتعيد Stripe", async () => {
  setEnv({ NODE_ENV: "production", STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET });
  const { POST } = await import("./billing/webhook/route");

  const unpaid = await POST(
    await signedWebhook({
      ...paidSession,
      data: { object: { ...paidSession.data.object, payment_status: "unpaid" } },
    }),
  );
  expect(unpaid.status).toBe(200);
  expect(await unpaid.json()).toMatchObject({ applied: false, reason: "unpaid" });

  const unknownPack = await POST(
    await signedWebhook({
      ...paidSession,
      data: {
        object: {
          ...paidSession.data.object,
          metadata: { clerkId: "user_1", packId: "mega", credits: "1000" },
        },
      },
    }),
  );
  expect(await unknownPack.json()).toMatchObject({ applied: false, reason: "invalid-credits" });

  expect((await POST(await signedWebhook(paidSession))).status).toBe(503);
});

test("الإنتاج بلا Clerk مع قاعدة بيانات: ميزات الحساب 503 (لا حساب محلي مشترك)", async () => {
  setEnv({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://user:pass@localhost:5432/never-touched",
  });
  const projects = await import("./projects/route");
  const project = await import("./projects/[id]/route");
  const renders = await import("./renders/route");
  const credits = await import("./credits/route");
  const ctx = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) };
  const get = () => new Request("http://localhost/api");
  const responses = [
    await projects.GET(),
    await project.GET(get(), ctx),
    await project.DELETE(get(), ctx),
    await renders.GET(get()),
    await credits.GET(),
  ];
  for (const res of responses) {
    expect(res.status).toBe(503);
  }
});

test("TTS: معرّف صوت يحقن SSML يُرفض 400 قبل أي مزوّد", async () => {
  setEnv({ NODE_ENV: "test", RATE_LIMIT_ALLOW_IN_MEMORY: "true" });
  const { POST } = await import("./tts/route");
  const res = await POST(
    post(
      JSON.stringify({
        text: "مرحبا",
        voiceId: "ar-SA-HamedNeural'><audio src='http://evil/x.mp3'/><voice name='x",
      }),
    ),
  );
  expect(res.status).toBe(400);
});

test("executeApi: خطأ داخلي غير مقصود لا تتسرب رسالته للعميل", async () => {
  const { z } = await import("zod");
  const { executeApi } = await import("../../helpers/api-response");
  const { UserFacingError } = await import("../../lib/user-facing-error");
  const leaky = executeApi(z.object({}), async () => {
    throw new Error("connect ECONNREFUSED 10.0.0.7:5432 secret-host");
  });
  const res = await leaky(post("{}"));
  expect(res.status).toBe(500);
  const body = (await res.json()) as { message: string };
  expect(body.message).not.toContain("10.0.0.7");

  const intended = executeApi(z.object({}), async () => {
    throw new UserFacingError("رسالة مقصودة للمستخدم");
  });
  const body2 = (await (await intended(post("{}"))).json()) as { message: string };
  expect(body2.message).toBe("رسالة مقصودة للمستخدم");
});


test("cron: بلا CRON_SECRET ⇒ 503، وسر خاطئ أو غائب ⇒ 401 قبل أي عمل", async () => {
  const { GET } = await import("./cron/retry-renders/route");
  setEnv({ NODE_ENV: "production" });
  expect((await GET(new Request("http://localhost/api/cron"))).status).toBe(503);

  setEnv({ NODE_ENV: "production", CRON_SECRET: "s3cret-value" });
  expect((await GET(new Request("http://localhost/api/cron"))).status).toBe(401);
  const wrong = new Request("http://localhost/api/cron", {
    headers: { authorization: "Bearer s3cret-valuX" },
  });
  expect((await GET(wrong)).status).toBe(401);
  // السر الصحيح يتجاوز الحارس (ثم 503 لغياب قاعدة البيانات، لا 401)
  const right = new Request("http://localhost/api/cron", {
    headers: { authorization: "Bearer s3cret-value" },
  });
  expect((await GET(right)).status).toBe(503);
});

test("المشاريع على قاعدة حقيقية: مستخدم لا يقرأ ولا يحذف مشروع غيره، والقائمة لكل مستخدم", async () => {
  const { db } = await createTestDb();
  const projects = await import("./projects/route");
  const project = await import("./projects/[id]/route");
  const credits = await import("./credits/route");
  try {
    setEnv({
      NODE_ENV: "test",
      ...CLERK,
      DATABASE_URL: "postgres://injected-pglite",
      RATE_LIMIT_ALLOW_IN_MEMORY: "true",
    });
    setDbForTests(db);

    clerkUserId = "user_owner";
    const saved = await projects.POST(
      post(JSON.stringify({ title: "مشروعي", props: defaultShortProps })),
    );
    expect(saved.status).toBe(200);
    const { data } = (await saved.json()) as { data: { id: string } };
    const ctx = { params: Promise.resolve({ id: data.id }) };
    const get = () => new Request("http://localhost/api");

    // مستخدم آخر: لا قراءة ولا حذف ولا ظهور في قائمته
    clerkUserId = "user_other";
    expect((await project.GET(get(), ctx)).status).toBe(404);
    expect((await project.DELETE(get(), ctx)).status).toBe(404);
    const otherList = (await (await projects.GET()).json()) as {
      data: { projects: unknown[] };
    };
    expect(otherList.data.projects).toHaveLength(0);
    const otherCredits = (await (await credits.GET()).json()) as { type: string };
    expect(otherCredits.type).toBe("success");

    // المالك ما زال يراه كاملاً ويستطيع حذفه
    clerkUserId = "user_owner";
    const own = await project.GET(get(), ctx);
    expect(own.status).toBe(200);
    expect(((await own.json()) as { data: { title: string } }).data.title).toBe("مشروعي");
    expect((await project.DELETE(get(), ctx)).status).toBe(200);
    expect((await project.GET(get(), ctx)).status).toBe(404);
  } finally {
    setDbForTests(null);
    resetDbForTests();
  }
});

test("health: بلا سر ردّ بسيط لا يكشف الإعداد، ومع السر الصحيح قائمة الناقص ورمز 503", async () => {
  const { GET } = await import("./health/route");
  setEnv({ NODE_ENV: "production", CRON_SECRET: "hs-secret" });

  for (const headers of [{} as Record<string, string>, { authorization: "Bearer wrong" }]) {
    const res = await GET(new Request("http://localhost/api/health", { headers }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  }

  const res = await GET(
    new Request("http://localhost/api/health", {
      headers: { authorization: "Bearer hs-secret" },
    }),
  );
  expect(res.status).toBe(503);
  const body = (await res.json()) as {
    status: string;
    missingRequired: string[];
    checks: Array<{ id: string }>;
  };
  expect(body.status).toBe("degraded");
  expect(body.missingRequired).toEqual(["blob", "database", "clerk", "upstash"]);
  expect(JSON.stringify(body)).not.toContain("hs-secret");

  // كل المطلوب مضبوط ⇒ 200 جاهز
  setEnv({
    NODE_ENV: "production",
    CRON_SECRET: "hs-secret",
    BLOB_READ_WRITE_TOKEN: "t",
    DATABASE_URL: "postgres://x",
    ...CLERK,
    UPSTASH_REDIS_REST_URL: "https://u",
    UPSTASH_REDIS_REST_TOKEN: "t",
  });
  const ready = await GET(
    new Request("http://localhost/api/health", {
      headers: { authorization: "Bearer hs-secret" },
    }),
  );
  expect(ready.status).toBe(200);
  expect(((await ready.json()) as { status: string }).status).toBe("ready");
});
