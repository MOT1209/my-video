import { BlobAccessError, del, put } from "@vercel/blob";
import { addBundleToSandbox, createSandbox } from "@remotion/vercel";
import { Snapshot } from "@vercel/sandbox";
import { bundleRemotionProject } from "./src/lib/remotion-bundle";
import { isSnapshotStorageQuotaError } from "./src/lib/snapshot-errors";
import { selectSnapshotsToPrune, snapshotsToKeep } from "./src/lib/snapshot-prune";

const getSnapshotBlobKey = () =>
  `snapshot-cache/${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}.json`;

/**
 * يحذف snapshots النشرات القديمة (كل نشر ينشئ واحدة بلا انتهاء صلاحية فتستنفد
 * حصة Hobby). في بناء **الإنتاج فقط**: بناء المعاينة لا يحذف أبداً كي لا يحذف
 * snapshot الإنتاج الحي. الفشل هنا لا يُفشل البناء.
 */
async function pruneOldSnapshots(protectedIds: string[] = []) {
  if (process.env.VERCEL_ENV !== "production") return;
  // القائمة تُقيَّد صراحةً بهذا المشروع: لا نحذف أبداً snapshots مشروع آخر في الفريق
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) return;
  try {
    const all = await (await Snapshot.list({ projectId })).toArray();
    const toDelete = selectSnapshotsToPrune(
      all.map((s) => ({ id: s.id, status: s.status, createdAt: s.createdAt })),
      snapshotsToKeep(),
      protectedIds,
    );
    for (const id of toDelete) {
      await (await Snapshot.get({ snapshotId: id })).delete();
    }
    if (toDelete.length > 0) {
      console.log(`[create-snapshot] Pruned ${toDelete.length} old snapshot(s).`);
    }
  } catch (error) {
    console.warn(
      "[create-snapshot] Snapshot pruning skipped:",
      (error as Error)?.message,
    );
  }
}

// بدون Blob store لا يمكن حفظ الـ snapshot — نتجاوز بخروج ناجح بدل إفشال البناء كله.
// ملاحظة: /api/render يحتاج التوكن على أي حال، فاربط Blob store واعمل redeploy للتصيير الفعلي.
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
if (!blobToken) {
  console.warn(
    "[create-snapshot] Skipping: BLOB_READ_WRITE_TOKEN is not set. " +
      "Build continues, but /api/render needs a Blob store. " +
      "Attach one (Vercel Dashboard > Storage > Create > Blob) and redeploy.",
  );
  process.exit(0);
}

// فحص مبكر: هل يقبل الـ store الرفع العام؟ نتأكد قبل حرق وقت sandbox (~40 ثانية).
// التطبيق يخدم فيديوهات وصوتيات بروابط عامة، لذلك يحتاج store يقبل public access.
const probeKey = `snapshot-cache/.write-probe.json`;
try {
  const probe = await put(
    probeKey,
    JSON.stringify({ ok: true, at: Date.now() }),
    {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: blobToken,
    },
  );
  await del(probe.url, { token: blobToken });
} catch (err) {
  if (err instanceof BlobAccessError) {
    console.warn(
      "[create-snapshot] Skipping: Blob store is private but this app uploads with public access. " +
        "Fix: Vercel Dashboard > Storage > your Blob store > Settings > allow public access (or attach a public store), then redeploy. " +
        "Build continues without a sandbox snapshot — preview works, but /api/render needs the fix.",
    );
    process.exit(0);
  }
  throw err;
}

let sandbox: Awaited<ReturnType<typeof createSandbox>>;
try {
  sandbox = await createSandbox({
    onProgress: ({ progress, message }) => {
      const pct = Math.round(progress * 100);
      console.log(`[create-snapshot] ${message} (${pct}%)`);
    },
  });
} catch (error) {
  // نفس سياسة أخطاء الحصة عند أخذ الـ snapshot: الـ snapshot تحسين أداء لا شرط
  // للنشر، فلا يُفشل حصة Hobby المستنفدة (402) البناء كله. التصيير في الإنتاج
  // ينشئ sandbox جديداً ويرفع الحزمة لكل جلسة.
  if (!isSnapshotStorageQuotaError(error)) throw error;
  console.warn(
    "[create-snapshot] Skipping: Vercel Snapshot Storage quota is exhausted (Hobby plan, resets monthly). " +
      "Deployment continues without a snapshot; production rendering will create a fresh sandbox per session. " +
      "Delete unused snapshots or upgrade to Pro to restore fast renders.",
  );
  await pruneOldSnapshots();
  process.exit(0);
}

try {
  console.log("[create-snapshot] Adding Remotion bundle...");
  bundleRemotionProject(".remotion");
  await addBundleToSandbox({ sandbox, bundleDir: ".remotion" });

  console.log("[create-snapshot] Taking snapshot...");
  let snapshotId: string | null = null;
  try {
    snapshotId = (await sandbox.snapshot({ expiration: 0 })).snapshotId;
  } catch (error) {
    if (!isSnapshotStorageQuotaError(error)) throw error;
    console.warn(
      "[create-snapshot] Vercel Snapshot Storage quota is exhausted. Continuing deployment without a snapshot; production rendering will create a fresh sandbox and upload the Remotion bundle for each new session.",
    );
  }

  if (snapshotId) {
    await put(getSnapshotBlobKey(), JSON.stringify({ snapshotId }), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: blobToken,
    });
    console.log(
      `[create-snapshot] Snapshot saved: ${snapshotId} (never expires)`,
    );
    await pruneOldSnapshots([snapshotId]);
  } else {
    // حصة ممتلئة عند أخذ الـ snapshot: نحرّر المساحة للنشر التالي
    await pruneOldSnapshots();
  }
} finally {
  await sandbox.stop().catch(() => {});
}
