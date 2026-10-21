import { expect, mock, test } from "bun:test";

mock.module("@vercel/blob", () => ({
  BlobAccessError: class BlobAccessError extends Error {},
  get: async () => null,
  head: async () => { throw new Error("not found"); },
}));
mock.module("@vercel/functions", () => ({ waitUntil: () => undefined }));
mock.module("../lib/auth", () => ({
  getRequestUser: async () =>
    process.env.NODE_ENV === "production" &&
    (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
      ? null
      : { clerkId: "local-test-user", email: null, authenticated: false },
  unauthorizedResponse: () => Response.json({ type: "error", message: "unauthorized" }, { status: 401 }),
  databaseNotConfiguredResponse: () => Response.json({ type: "error", message: "database unavailable" }, { status: 503 }),
}));
mock.module("../lib/db/client", () => ({
  isDatabaseConfigured: () => Boolean(process.env.DATABASE_URL),
  getDb: () => null,
}));
mock.module("../lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, retryAfterSec: 0 }),
  clientIp: () => "127.0.0.1",
  rateLimitUnavailableResponse: () => Response.json({ type: "error", message: "rate limit unavailable" }, { status: 503 }),
  rateLimitedResponse: () => Response.json({ type: "error", message: "rate limited" }, { status: 429 }),
}));
const renderLockMock = {
  acquire: async (key: string) => {
    void key;
    return "test-lock-owner" as string | null;
  },
};
mock.module("../lib/render-lock", () => ({
  acquireRenderLock: (...args: unknown[]) => renderLockMock.acquire(...(args as [string])),
  releaseRenderLock: async () => undefined,
  RENDER_LOCK_RETRY_SEC: 60,
}));

const { POST } = await import("../app/api/render/route");

function makeRequest(body: string, headers: Record<string, string> = { "content-type": "application/json" }): Request {
  return new Request("https://my-video.example/api/render", { method: "POST", headers, body });
}

const keys = ["NODE_ENV", "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "DATABASE_URL", "BLOB_READ_WRITE_TOKEN"] as const;
const saved = keys.map((key) => process.env[key]);
function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

function restoreEnv(): void {
  keys.forEach((key, i) => {
    const value = saved[i];
    if (value === undefined) delete process.env[key];
    else if (key === "NODE_ENV") setNodeEnv(value);
    else process.env[key] = value;
  });
}

test("render fails closed in production when Clerk keys are absent", async () => {
  setNodeEnv("production");
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  try {
    const response = await POST(makeRequest("{}"));
    expect(response.status).toBe(401);
  } finally {
    restoreEnv();
  }
});

test("render rejects missing production database before any expensive work", async () => {
  setNodeEnv("production");
  process.env.CLERK_SECRET_KEY = "test-secret";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "test-publishable";
  delete process.env.DATABASE_URL;
  try {
    const response = await POST(makeRequest("{}"));
    expect(response.status).toBe(503);
  } finally {
    restoreEnv();
  }
});

test("render returns controlled JSON errors for wrong content type and malformed JSON", async () => {
  setNodeEnv("development");
  process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
  try {
    const unsupported = await POST(makeRequest("{}", { "content-type": "text/plain" }));
    expect(unsupported.status).toBe(415);

    const malformed = await POST(makeRequest("{"));
    expect(malformed.status).toBe(400);
  } finally {
    restoreEnv();
  }
});

test("render fails closed when the distributed lock service is unavailable", async () => {
  setNodeEnv("production");
  process.env.CLERK_SECRET_KEY = "test-secret";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "test-publishable";
  process.env.DATABASE_URL = "postgresql://ci:ci@127.0.0.1/ci";
  process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
  renderLockMock.acquire = async () => {
    throw new Error("render_lock_unavailable");
  };
  try {
    const response = await POST(makeRequest(JSON.stringify({
      id: "MyComp",
      inputProps: { title: "test" },
    })));
    expect(response.status).toBe(503);
  } finally {
    renderLockMock.acquire = async () => "test-lock-owner";
    restoreEnv();
  }
});

test("render returns a safe 503 when Blob configuration is absent", async () => {
  setNodeEnv("development");
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    const response = await POST(makeRequest("{}"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("BLOB_READ_WRITE_TOKEN");
  } finally {
    restoreEnv();
  }
});
