import { afterEach, expect, mock, test } from "bun:test";
import Stripe from "stripe";
import { resetDbForTests } from "../../lib/db/client";
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
  auth: async () => {
    if (process.env.CLERK_AUTH_TEST_FAILURE === "true") {
      throw new Error("test-only Clerk failure");
    }
    return { userId: clerkUserId, sessionClaims: { email: null } };
  },
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
  "CLERK_AUTH_TEST_FAILURE",
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

test("الإنتاج بلا Clerk: كل المسارات المكلفة تُغلق قبل التحقق من المدخلات", async () => {
  setEnv({ NODE_ENV: "production", BLOB_READ_WRITE_TOKEN: "tok" });
  const routes = await Promise.all([
    import("./render/route"),
    import("./script/route"),
    import("./image/route"),
    import("./tts/route"),
    import("./transcribe/route"),
  ]);
  const requests = [
    post(JSON.stringify(validShort)),
    post(JSON.stringify({ topic: "موضوع اختبار" })),
    post(JSON.stringify({ prompt: "خلفية اختبار" })),
    post(JSON.stringify({ text: "نص اختبار" })),
    new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=invalid" },
      body: "invalid",
    }),
  ];
  for (const [index, route] of routes.entries()) {
    const response = await route.POST(requests[index]);
    expect(response.status).toBe(503);
  }
});

test("Clerk مفعّل والطلب غير مسجّل ⇒ 401 على كل المسارات المحمية", async () => {
  setEnv({
    NODE_ENV: "production",
    ...CLERK,
    RATE_LIMIT_ALLOW_IN_MEMORY: "true",
    ALLOW_ANONYMOUS_PAID_ROUTES: undefined,
    BLOB_READ_WRITE_TOKEN: "tok",
  });
  clerkUserId = null;
  const [render, credits, projects, renders, projectById, checkoutRoute] =
    await Promise.all([
      import("./render/route"),
      import("./credits/route"),
      import("./projects/route"),
      import("./renders/route"),
      import("./projects/[id]/route"),
      import("./billing/checkout/route"),
    ]);
  expect((await render.POST(post(JSON.stringify(validShort)))).status).toBe(401);
  expect((await credits.GET()).status).toBe(401);
  expect((await projects.GET()).status).toBe(401);
  expect((await renders.GET(new Request("http://localhost/api/renders"))).status).toBe(401);
  expect(
    (
      await projectById.GET(new Request("http://localhost/api/projects/id"), {
        params: Promise.resolve({ id: "id" }),
      })
    ).status,
  ).toBe(401);
  expect(
    (await checkoutRoute.POST(post(JSON.stringify({ packId: "starter" })))).status,
  ).toBe(401);
});

test("الطلب المسجّل بلا DATABASE_URL يعيد 503 لبيانات الحساب", async () => {
  setEnv({ NODE_ENV: "production", ...CLERK });
  clerkUserId = "user_without_database";
  const [{ GET: credits }, { GET: projects }, { GET: renders }] = await Promise.all([
    import("./credits/route"),
    import("./projects/route"),
    import("./renders/route"),
  ]);
  expect((await credits()).status).toBe(503);
  expect((await projects()).status).toBe(503);
  expect((await renders(new Request("http://localhost/api/renders"))).status).toBe(503);
});

test("فشل Clerk في التحقق يعيد 503 آمناً بدلاً من 500", async () => {
  setEnv({
    NODE_ENV: "production",
    ...CLERK,
  });
  clerkUserId = null;
  const { GET } = await import("./credits/route");
  process.env.CLERK_AUTH_TEST_FAILURE = "true";
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    type: "error",
    code: "AUTH_UNAVAILABLE",
  });
  const { requireSession } = await import("../../lib/session");
  const result = await requireSession();
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.response.status).toBe(503);
    expect(await result.response.json()).toMatchObject({
      type: "error",
      code: "AUTH_UNAVAILABLE",
    });
  }
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
  setEnv({
    NODE_ENV: "production",
    ...CLERK,
    BLOB_READ_WRITE_TOKEN: "tok",
  });
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
