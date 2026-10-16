import { describe, expect, mock, test } from "bun:test";
import {
  acquireSessionSandbox,
  dropSessionSandbox,
  holdSessionSandbox,
  SANDBOX_IDLE_STOP_MS,
  sandboxSessionLifetimeSeconds,
  stopStaleSandboxSessions,
} from "./sandbox-session";

/** sandbox وهمي بلا شبكة ولا عمليات حقيقية. */
function fakeSandbox() {
  return {
    stop: mock(() => Promise.resolve()),
    extendTimeout: mock(() => Promise.resolve()),
  } as unknown as import("@vercel/sandbox").Sandbox;
}

describe("جلسة sandbox", () => {
  test("جلب جلسة غير موجودة يعيد null", () => {
    expect(acquireSessionSandbox("no-such-session")).toBeNull();
  });

  test("حفظ ثم جلب يعيد نفس الـ sandbox", () => {
    const sb = fakeSandbox();
    holdSessionSandbox("sess-a", sb, 60_000);
    expect(acquireSessionSandbox("sess-a")).toBe(sb);
    expect(sb.extendTimeout).toHaveBeenCalledWith(60_000);
  });

  test("حفظ الجلسة نفسها مرتين يحافظ على عمر الإنشاء الأصلي", () => {
    const sb = fakeSandbox();
    const t0 = Date.now();
    holdSessionSandbox("sess-age", sb, 0, t0);
    // إعادة استخدام بعد 20 ثانية: العمر يبقى محسوباً من الإنشاء
    holdSessionSandbox("sess-age", sb, 0, t0 + 20_000);
    expect(sandboxSessionLifetimeSeconds("sess-age", t0 + 25_000)).toBe(25);
  });

  test("الخمول بعد TTL يوقف الـ sandbox ويُهجر الجلسة", () => {
    const sb = fakeSandbox();
    const now = 1_000_000;
    holdSessionSandbox("sess-b", sb, 0, now);
    // فوراً: لا شيء خاملاً
    expect(stopStaleSandboxSessions(now + 1000)).toBe(0);
    // بعد الخمول: إيقاف واحد
    expect(stopStaleSandboxSessions(now + SANDBOX_IDLE_STOP_MS)).toBe(1);
    expect(sb.stop).toHaveBeenCalledTimes(1);
    expect(acquireSessionSandbox("sess-b")).toBeNull();
  });

  test("إعادة الحفظ تدفع موعد الخمول (refresh)", () => {
    const sb = fakeSandbox();
    const now = 2_000_000;
    holdSessionSandbox("sess-c", sb, 0, now);
    // بعد 80 ثانية يُعاد حفظها في التصيير الثاني، فلا تُعتبَر خاملة بعد 100 ثانية
    holdSessionSandbox("sess-c", sb, 0, now + 80_000);
    expect(stopStaleSandboxSessions(now + 100_000)).toBe(0);
    expect(sb.stop).not.toHaveBeenCalled();
    expect(
      stopStaleSandboxSessions(now + 80_000 + SANDBOX_IDLE_STOP_MS),
    ).toBe(1);
  });

  test("تمديد timeout=0 لا يستدعي extendTimeout", () => {
    const sb = fakeSandbox();
    holdSessionSandbox("sess-d", sb, 0);
    expect(sb.extendTimeout).not.toHaveBeenCalled();
  });

  test("dropSessionSandbox يوقف ويزيل الجلسة", async () => {
    const sb = fakeSandbox();
    holdSessionSandbox("sess-e", sb, 0);
    await dropSessionSandbox("sess-e");
    expect(sb.stop).toHaveBeenCalledTimes(1);
    expect(acquireSessionSandbox("sess-e")).toBeNull();
    // إسقاط جلسة غير موجودة لا يفعل شيئاً ولا يفشل
    await dropSessionSandbox("no-such");
  });

  test("عمر جلسة غير موجودة = null", () => {
    expect(sandboxSessionLifetimeSeconds("no-such")).toBeNull();
  });
});
