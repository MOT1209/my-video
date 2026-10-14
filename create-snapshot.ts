import { BlobAccessError, del, put } from "@vercel/blob";
import { addBundleToSandbox, createSandbox } from "@remotion/vercel";
import { bundleRemotionProject } from "./src/app/api/render/helpers";

const getSnapshotBlobKey = () =>
  `snapshot-cache/${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}.json`;

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
  const probe = await put(probeKey, JSON.stringify({ ok: true, at: Date.now() }), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    token: blobToken,
  });
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

const sandbox = await createSandbox({
  onProgress: ({ progress, message }) => {
    const pct = Math.round(progress * 100);
    console.log(`[create-snapshot] ${message} (${pct}%)`);
  },
});

console.log("[create-snapshot] Adding Remotion bundle...");
bundleRemotionProject(".remotion");
await addBundleToSandbox({ sandbox, bundleDir: ".remotion" });

console.log("[create-snapshot] Taking snapshot...");
const snapshot = await sandbox.snapshot({ expiration: 0 });
const { snapshotId } = snapshot;

await put(getSnapshotBlobKey(), JSON.stringify({ snapshotId }), {
  access: "public",
  contentType: "application/json",
  addRandomSuffix: false,
  token: blobToken,
});

console.log(`[create-snapshot] Snapshot saved: ${snapshotId} (never expires)`);
