/**
 * اختيار snapshots Vercel Sandbox القديمة للحذف. كل نشر ينشئ snapshot بلا
 * انتهاء صلاحية (~700MB)، فتتراكم حتى تستنفد حصة Hobby وتفشل النشرات.
 *
 * دالة نقية: تُبقي الأحدث `keep` من الحالة `created` وكل المعرّفات المحمية،
 * وتُعيد ما عداها للحذف. الصف `deleted`/`failed` لا يُحتسب ولا يُحذف ثانية.
 */
export interface SnapshotInfo {
  id: string;
  status: "failed" | "created" | "deleted";
  createdAt: number;
}

export const DEFAULT_SNAPSHOTS_TO_KEEP = 3;

/** عدد snapshots المحتفَظ بها: من البيئة إن صحّ (≥ 1)، وإلا الافتراضي. */
export function snapshotsToKeep(
  env: Record<string, string | undefined> = process.env,
): number {
  const value = Number(env.SNAPSHOTS_TO_KEEP);
  return Number.isInteger(value) && value >= 1 ? value : DEFAULT_SNAPSHOTS_TO_KEEP;
}

export function selectSnapshotsToPrune(
  snapshots: SnapshotInfo[],
  keep: number,
  protectedIds: readonly string[] = [],
): string[] {
  const protectedSet = new Set(protectedIds);
  const live = snapshots
    .filter((s) => s.status === "created")
    .sort((a, b) => b.createdAt - a.createdAt);
  const kept = new Set(live.slice(0, Math.max(keep, 1)).map((s) => s.id));
  return live
    .filter((s) => !kept.has(s.id) && !protectedSet.has(s.id))
    .map((s) => s.id);
}
