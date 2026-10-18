import { expect, test } from "bun:test";
import {
  isSandboxSnapshotUnavailableError,
  isSnapshotStorageQuotaError,
  SandboxSnapshotUnavailableError,
} from "./snapshot-errors";

test("recognizes the explicit missing-snapshot error", () => {
  expect(
    isSandboxSnapshotUnavailableError(new SandboxSnapshotUnavailableError()),
  ).toBe(true);
});

test("recognizes a missing snapshot Blob", () => {
  expect(
    isSandboxSnapshotUnavailableError(new Error("BlobNotFoundError: missing")),
  ).toBe(true);
});

test("recognizes a Vercel 404 for a snapshot", () => {
  expect(
    isSandboxSnapshotUnavailableError({
      message: "Not found",
      response: { status: 404 },
      text: "snapshot does not exist",
    }),
  ).toBe(true);
});

test("does not treat unrelated Vercel failures as a missing snapshot", () => {
  expect(
    isSandboxSnapshotUnavailableError(new Error("network unavailable")),
  ).toBe(false);
  expect(
    isSandboxSnapshotUnavailableError({
      message: "Not found",
      response: { status: 404 },
      text: "deployment does not exist",
    }),
  ).toBe(false);
  expect(
    isSandboxSnapshotUnavailableError({
      message: "Unauthorized",
      response: { status: 401 },
      text: "snapshot access denied",
    }),
  ).toBe(false);
});

test("recognizes only the Vercel snapshot storage quota 402 response", () => {
  expect(
    isSnapshotStorageQuotaError({
      message: "Status code 402 is not ok",
      response: { status: 402 },
      text: "Hobby plan usage limit exceeded for Snapshots Storage.",
    }),
  ).toBe(true);
  expect(
    isSnapshotStorageQuotaError({
      message: "Status code 402 is not ok",
      response: { status: 402 },
      text: "payment required for another resource",
    }),
  ).toBe(false);
  expect(
    isSnapshotStorageQuotaError({
      message: "Snapshot storage quota exceeded",
      response: { status: 500 },
      text: "snapshot storage quota exceeded",
    }),
  ).toBe(false);
});
