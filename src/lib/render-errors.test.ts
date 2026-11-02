import { describe, expect, test } from "bun:test";
import {
  friendlyRenderError,
  GENERIC_RENDER_ERROR,
  isRetryableRenderError,
  isStoppedSandboxError,
} from "./render-errors";
import { SandboxSnapshotUnavailableError } from "./snapshot-errors";

describe("isStoppedSandboxError", () => {
  test("يتعرف على توقف/انتهاء الـ sandbox", () => {
    expect(isStoppedSandboxError(new Error("sandbox_stopped"))).toBe(true);
    expect(isStoppedSandboxError(new Error("The sandbox has expired"))).toBe(
      true,
    );
  });
  test("لا يطابق كل رسالة فيها expired", () => {
    expect(isStoppedSandboxError(new Error("Signed URL expired"))).toBe(false);
    expect(isStoppedSandboxError(new Error("token expired"))).toBe(false);
  });
});

describe("isRetryableRenderError", () => {
  test("أعطال البنية قابلة لإعادة المحاولة", () => {
    expect(isRetryableRenderError(new Error("sandbox_stopped"))).toBe(true);
    expect(isRetryableRenderError(new SandboxSnapshotUnavailableError())).toBe(
      true,
    );
    expect(isRetryableRenderError(new Error("fetch failed"))).toBe(true);
    expect(
      isRetryableRenderError(
        Object.assign(new Error("boom"), { code: "ECONNRESET" }),
      ),
    ).toBe(true);
  });
  test("فشل المحتوى وغير المعروف نهائي", () => {
    expect(isRetryableRenderError(new Error("delayRender() timed out"))).toBe(
      false,
    );
    expect(isRetryableRenderError(new Error("Sandbox crashed"))).toBe(false);
    expect(isRetryableRenderError(new Error("anything else"))).toBe(false);
  });
});

test("friendlyRenderError لا يكشف الرسالة الخام", () => {
  expect(
    friendlyRenderError(
      new Error("ENOENT /vercel/sandbox/out/video.mp4 token=abc"),
    ),
  ).toBe(GENERIC_RENDER_ERROR);
});
