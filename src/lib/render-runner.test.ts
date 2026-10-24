import { afterEach, expect, mock, test } from "bun:test";
import type { VercelSandbox } from "@remotion/vercel";

mock.module("@vercel/blob", () => ({
  BlobAccessError: class BlobAccessError extends Error {},
  get: async () => null,
}));
import { SandboxSnapshotUnavailableError } from "./snapshot-errors";
import { dropSessionSandbox } from "./sandbox-session";

const sandbox = {
  stop: async () => {},
  extendTimeout: async () => {},
} as unknown as VercelSandbox;
const createSandbox = mock(async () => sandbox);
const addBundleToSandbox = mock(async () => {});
const bundleRemotionProject = mock(() => {});
const renderMediaOnVercel = mock(async () => ({
  sandboxFilePath: "/render/output.mp4",
  contentType: "video/mp4",
}));
const uploadToVercelBlob = mock(async () => ({
  url: "https://blob.example/render.mp4",
  size: 1024,
}));
const restoreSnapshot = mock(async () => sandbox);

mock.module("@remotion/vercel", () => ({
  addBundleToSandbox,
  createSandbox,
  renderMediaOnVercel,
  uploadToVercelBlob,
}));
mock.module("./remotion-bundle", () => ({ bundleRemotionProject }));
mock.module("./restore-snapshot", () => ({ restoreSnapshot }));
// mock.module يتسرّب بين الملفات في bun: نُبقي بقية واجهة الوحدة حقيقية
const realRenderErrors = await import("./render-errors");
mock.module("./render-errors", () => ({
  ...realRenderErrors,
  isStoppedSandboxError: () => false,
}));

const { runRenderOnce } = await import("./render-runner");
const originalVercel = process.env.VERCEL;

afterEach(async () => {
  await dropSessionSandbox("render-sandbox:test");
  for (const fn of [
    createSandbox,
    addBundleToSandbox,
    bundleRemotionProject,
    renderMediaOnVercel,
    uploadToVercelBlob,
    restoreSnapshot,
  ]) {
    fn.mockClear();
  }
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

const options = {
  compositionId: "ShortsComp",
  inputProps: {},
  blobPath: "renders-cache/test.mp4",
  blobToken: "blob-token",
  sessionKey: "render-sandbox:test",
};

test("production uploads the Remotion bundle when no snapshot is available", async () => {
  process.env.VERCEL = "1";
  restoreSnapshot.mockImplementation(async () => {
    throw new SandboxSnapshotUnavailableError();
  });

  const outcome = await runRenderOnce(options);

  expect(outcome.url).toBe("https://blob.example/render.mp4");
  expect(createSandbox).toHaveBeenCalledWith(
    expect.objectContaining({ resources: { vcpus: 2 } }),
  );
  expect(addBundleToSandbox).toHaveBeenCalledWith({
    sandbox,
    bundleDir: ".remotion",
  });
  expect(bundleRemotionProject).not.toHaveBeenCalled();
});

test("production reuses the bundle inside an available snapshot", async () => {
  process.env.VERCEL = "1";
  restoreSnapshot.mockImplementation(async () => sandbox);

  await runRenderOnce(options);

  expect(createSandbox).not.toHaveBeenCalled();
  expect(addBundleToSandbox).not.toHaveBeenCalled();
});

test("production does not hide snapshot authorization or service errors", async () => {
  process.env.VERCEL = "1";
  const failure = new Error("Snapshot service unavailable");
  restoreSnapshot.mockImplementation(async () => {
    throw failure;
  });

  await expect(runRenderOnce(options)).rejects.toBe(failure);
  expect(createSandbox).not.toHaveBeenCalled();
});
