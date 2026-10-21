import { randomUUID } from "node:crypto";
import { getUpstashRedis } from "./upstash-redis";

const RENDER_LOCK_TTL_SEC = 600;
export const RENDER_LOCK_RETRY_SEC = 60;

const localLocks = new Map<string, { owner: string; expiresAt: number }>();
const RELEASE_OWNED_LOCK = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) end return 0`;

/** Acquires a distributed render lock and returns its owner token. */
export async function acquireRenderLock(
  key: string,
  now = Date.now(),
): Promise<string | null> {
  const redis = getUpstashRedis();
  if (redis) {
    const owner = randomUUID();
    try {
      const result = await redis.set(key, owner, { nx: true, ex: RENDER_LOCK_TTL_SEC });
      return result === "OK" || (result as { ok?: string } | null)?.ok === "OK" ? owner : null;
    } catch (err) {
      console.warn("render-lock: فشل Upstash", err);
      if (process.env.NODE_ENV === "production") throw err;
    }
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("render_lock_unavailable");
  }

  const activeLock = localLocks.get(key);
  if (activeLock && activeLock.expiresAt > now) return null;
  const owner = randomUUID();
  localLocks.set(key, { owner, expiresAt: now + RENDER_LOCK_TTL_SEC * 1000 });
  return owner;
}

/** Releases a lock only while its owner token still matches. */
export async function releaseRenderLock(key: string, owner: string): Promise<void> {
  const redis = getUpstashRedis();
  if (redis) {
    await redis.eval(RELEASE_OWNED_LOCK, [key], [owner]);
  }
  if (localLocks.get(key)?.owner === owner) localLocks.delete(key);
}
