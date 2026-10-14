/**
 * تنظيف Blobs القديمة (أصوات Shorts + snapshots) لتقليل التكلفة.
 * يعمل محلياً عبر bun ويحتاج BLOB_READ_WRITE_TOKEN.
 *
 *   bun scripts/cleanup-blobs.ts                  # عرض فقط (dry-run) لأقدم من 30 يوم
 *   bun scripts/cleanup-blobs.ts --delete           # حذف فعلي
 *   bun scripts/cleanup-blobs.ts --delete --older-than-days=7
 */

export {};

const PREFIXES = ["shorts-audio/", "snapshot-cache/"];

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? (hit.split("=")[1] as string) : fallback;
}

const DELETE = process.argv.includes("--delete");
const OLDER_THAN_DAYS = Number(arg("older-than-days", "30"));

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("BLOB_READ_WRITE_TOKEN is not set.");
  process.exit(1);
}

const { list, del } = await import("@vercel/blob");

const cutoff = Date.now() - OLDER_THAN_DAYS * 24 * 60 * 60 * 1000;
let total = 0;

for (const prefix of PREFIXES) {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, token, limit: 1000 });
    const old = page.blobs.filter(
      (b) => new Date(b.uploadedAt).getTime() < cutoff,
    );
    for (const blob of old) {
      total += 1;
      if (DELETE) {
        await del(blob.url, { token });
        console.log(`deleted ${blob.pathname}`);
      } else {
        console.log(`would delete ${blob.pathname} (${blob.uploadedAt})`);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}

console.log(
  DELETE
    ? `Done. Deleted ${total} blob(s) older than ${OLDER_THAN_DAYS} days.`
    : `Dry run. ${total} blob(s) older than ${OLDER_THAN_DAYS} days. Re-run with --delete to remove them.`,
);
