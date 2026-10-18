import { get } from "@vercel/blob";
import { Sandbox } from "@vercel/sandbox";
import { PROD_SANDBOX_VCPUS } from "./render-metrics";
import {
  isSandboxSnapshotUnavailableError,
  SandboxSnapshotUnavailableError,
} from "./snapshot-errors";

const SANDBOX_CREATING_TIMEOUT = 5 * 60 * 1000;

const getSnapshotBlobKey = () =>
  `snapshot-cache/${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}.json`;

/**
 * نمرر عدد الـ vCPUs صراحةً بدل الاعتماد على الافتراضي السحابي،
 * حتى تتطابق الأرقام المسجّلة ‎$/video‎ مع ما يُحسب فعلياً في الفاتورة.
 */
export async function restoreSnapshot(vcpus: number = PROD_SANDBOX_VCPUS) {
  let blob;
  try {
    blob = await get(getSnapshotBlobKey(), {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  } catch (error) {
    if (isSandboxSnapshotUnavailableError(error)) {
      throw new SandboxSnapshotUnavailableError();
    }
    throw error;
  }
  if (!blob) {
    throw new SandboxSnapshotUnavailableError();
  }

  let cache: { snapshotId?: string };
  try {
    const response = new Response(blob.stream);
    cache = await response.json();
  } catch {
    throw new SandboxSnapshotUnavailableError(
      "The stored sandbox snapshot record is invalid.",
    );
  }
  const snapshotId = cache.snapshotId;

  if (!snapshotId) {
    throw new SandboxSnapshotUnavailableError(
      "The stored sandbox snapshot record has no snapshot ID.",
    );
  }

  try {
    return await Sandbox.create({
      source: { type: "snapshot", snapshotId },
      resources: { vcpus },
      timeout: SANDBOX_CREATING_TIMEOUT,
    });
  } catch (error) {
    if (isSandboxSnapshotUnavailableError(error)) {
      throw new SandboxSnapshotUnavailableError(
        "The stored sandbox snapshot has expired or was removed.",
      );
    }
    throw error;
  }
}
