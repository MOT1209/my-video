import { expect, test } from "bun:test";
import {
  DEFAULT_SNAPSHOTS_TO_KEEP,
  selectSnapshotsToPrune,
  snapshotsToKeep,
  type SnapshotInfo,
} from "./snapshot-prune";

const snap = (id: string, createdAt: number, status: SnapshotInfo["status"] = "created"): SnapshotInfo => ({
  id,
  createdAt,
  status,
});

test("يُبقي الأحدث keep ويحذف الأقدم", () => {
  const all = [snap("a", 1), snap("b", 5), snap("c", 3), snap("d", 4), snap("e", 2)];
  expect(selectSnapshotsToPrune(all, 3).sort()).toEqual(["a", "e"]);
});

test("لا يحذف شيئاً إن كان العدد ≤ keep", () => {
  expect(selectSnapshotsToPrune([snap("a", 1), snap("b", 2)], 3)).toEqual([]);
  expect(selectSnapshotsToPrune([], 3)).toEqual([]);
});

test("المعرّفات المحمية لا تُحذف حتى لو قديمة", () => {
  const all = [snap("old", 1), snap("n1", 10), snap("n2", 9), snap("n3", 8)];
  expect(selectSnapshotsToPrune(all, 3, ["old"])).toEqual([]);
  expect(selectSnapshotsToPrune(all, 3)).toEqual(["old"]);
});

test("المحذوفة والفاشلة لا تُحتسب ضمن keep ولا تُعاد للحذف", () => {
  const all = [
    snap("gone", 100, "deleted"),
    snap("bad", 99, "failed"),
    snap("a", 3),
    snap("b", 2),
    snap("c", 1),
  ];
  expect(selectSnapshotsToPrune(all, 2)).toEqual(["c"]);
});

test("keep أقل من 1 يُعامل كـ 1 فلا يحذف الأحدث أبداً", () => {
  const all = [snap("a", 2), snap("b", 1)];
  expect(selectSnapshotsToPrune(all, 0)).toEqual(["b"]);
});

test("snapshotsToKeep: افتراضي أو من البيئة بقيمة صالحة فقط", () => {
  expect(snapshotsToKeep({})).toBe(DEFAULT_SNAPSHOTS_TO_KEEP);
  expect(snapshotsToKeep({ SNAPSHOTS_TO_KEEP: "5" })).toBe(5);
  expect(snapshotsToKeep({ SNAPSHOTS_TO_KEEP: "0" })).toBe(DEFAULT_SNAPSHOTS_TO_KEEP);
  expect(snapshotsToKeep({ SNAPSHOTS_TO_KEEP: "abc" })).toBe(DEFAULT_SNAPSHOTS_TO_KEEP);
  expect(snapshotsToKeep({ SNAPSHOTS_TO_KEEP: "2.5" })).toBe(DEFAULT_SNAPSHOTS_TO_KEEP);
});
