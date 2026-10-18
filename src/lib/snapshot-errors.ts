export class SandboxSnapshotUnavailableError extends Error {
  constructor(
    message = "No sandbox snapshot is available for this deployment.",
  ) {
    super(message);
    this.name = "SandboxSnapshotUnavailableError";
  }
}

function getErrorText(error: unknown): string {
  if (typeof error !== "object" || error === null)
    return String(error).toLowerCase();

  const value = error as {
    name?: unknown;
    message?: unknown;
    text?: unknown;
    json?: unknown;
  };
  return [
    value.name,
    value.message,
    value.text,
    JSON.stringify(value.json ?? ""),
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

function getResponseStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const status = (error as { response?: { status?: unknown } }).response
    ?.status;
  return typeof status === "number" ? status : undefined;
}

/** True only for an absent/expired snapshot, not unrelated auth or network errors. */
export function isSandboxSnapshotUnavailableError(error: unknown): boolean {
  if (error instanceof SandboxSnapshotUnavailableError) return true;
  const text = getErrorText(error);
  return (
    (getResponseStatus(error) === 404 && text.includes("snapshot")) ||
    text.includes("blobnotfounderror") ||
    text.includes("requested blob does not exist")
  );
}

/** Recognizes the Hobby-plan snapshot-storage quota response from Vercel. */
export function isSnapshotStorageQuotaError(error: unknown): boolean {
  const text = getErrorText(error);
  return (
    getResponseStatus(error) === 402 &&
    text.includes("snapshot") &&
    text.includes("storage")
  );
}
