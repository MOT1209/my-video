import { get } from "@vercel/blob";
import { Sandbox } from "@vercel/sandbox";
import { PROD_SANDBOX_VCPUS } from "./render-metrics";

const SANDBOX_CREATING_TIMEOUT = 5 * 60 * 1000;

const getSnapshotBlobKey = () =>
  `snapshot-cache/${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}.json`;

/**
 * نمرر عدد الـ vCPUs صراحةً بدل الاعتماد على الافتراضي السحابي،
 * حتى تتطابق الأرقام المسجّلة ‎$/video‎ مع ما يُحسب فعلياً في الفاتورة.
 */
export async function restoreSnapshot(vcpus: number = PROD_SANDBOX_VCPUS) {
  const blob = await get(getSnapshotBlobKey(), {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (!blob) {
    throw new Error(
      "No sandbox snapshot found. Run `bun run create-snapshot` as part of the build process.",
    );
  }

  const response = new Response(blob.stream);
  const cache: { snapshotId: string } = await response.json();
  const snapshotId = cache.snapshotId;

  if (!snapshotId) {
    throw new Error(
      "No sandbox snapshot found. Run `bun run create-snapshot` as part of the build process.",
    );
  }

  return Sandbox.create({
    source: { type: "snapshot", snapshotId },
    resources: { vcpus },
    timeout: SANDBOX_CREATING_TIMEOUT,
  });
}
