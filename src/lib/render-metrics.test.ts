import { describe, expect, test } from "bun:test";
import { estimateRenderCostUsd, logRenderMetrics } from "./render-metrics";

test("تكلفة صفرية عند 0 ثانية و 0 بايت", () => {
  const cost = estimateRenderCostUsd({ sandboxWallSeconds: 0, vcpus: 2, blobBytes: 0 });
  expect(cost.totalUsd).toBe(0);
});

describe("تقدّر تكلفة تصيير 10 دقائق على 2 vCPU", () => {
  // 2 * 0.128 * 0.6 * (600/3600) = 0.0256 (Active CPU)
  // 2 * 2 * 0.0212 * (600/3600) = 0.01413… (Memory)
  // 22MB * 0.15/GB           ≈ 0.003075 (Network)
  const cost = estimateRenderCostUsd({ sandboxWallSeconds: 600, vcpus: 2, blobBytes: 22_000_000 });

  test("Active CPU", () => {
    expect(cost.activeCpuUsd).toBeCloseTo(0.0256, 6);
  });

  test("Memory", () => {
    expect(cost.memoryUsd).toBeCloseTo(0.014133, 5);
  });

  test("Network", () => {
    expect(cost.networkUsd).toBeCloseTo((22e6 / 2 ** 30) * 0.15, 6);
  });

  test("الإجمالي = المجموع", () => {
    expect(cost.totalUsd).toBeCloseTo(cost.activeCpuUsd + cost.memoryUsd + cost.networkUsd, 9);
  });
});

test("عدد أكبر من vCPUs يعني تكلفة أعلى", () => {
  const small = estimateRenderCostUsd({ sandboxWallSeconds: 300, vcpus: 1, blobBytes: 0 });
  const large = estimateRenderCostUsd({ sandboxWallSeconds: 300, vcpus: 8, blobBytes: 0 });
  expect(large.totalUsd).toBeGreaterThan(small.totalUsd);
});

test("logRenderMetrics يكتب سطر JSON قابل للفرز", () => {
  const logs: string[] = [];
  const original = console.log;
  console.log = (line: string) => {
    logs.push(String(line));
  };
  try {
    logRenderMetrics({
      compositionId: "ShortsComp",
      cachePath: "renders-cache/ShortsComp/x.mp4",
      cached: false,
      sandboxWallSeconds: 42,
      vcpus: 2,
      blobBytes: 1024,
      estimatedCostUsd: { activeCpuUsd: 0, memoryUsd: 0, networkUsd: 0, totalUsd: 0 },
    });
  } finally {
    console.log = original;
  }
  expect(logs).toHaveLength(1);
  const parsed = JSON.parse(logs[0]) as { event: string; cached: boolean };
  expect(parsed.event).toBe("render-metrics");
  expect(parsed.cached).toBe(false);
});
