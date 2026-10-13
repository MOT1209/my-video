import { put } from "@vercel/blob";
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
