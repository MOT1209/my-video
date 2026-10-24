import type { NextResponse } from "next/server";
import {
  authServiceUnavailableResponse,
  databaseNotConfiguredResponse,
  databaseUnavailableResponse,
  getRequestUser,
  unauthorizedResponse,
} from "./auth";
import { getDb, isDatabaseConfigured, type Db } from "./db/client";
import { ensureUser, type UserRow } from "./db/repository";

/**
 * حارس المسارات المحمية: مصادقة + قاعدة بيانات + صف المستخدم.
 *
 * الترتيب مقصود: نرفض غير المسجّل أولاً (401) قبل أي لمس لقاعدة البيانات،
 * ثم نوضّح غياب DATABASE_URL (503) برسالة إرشادية بدل خطأ 500 غامض.
 */
export interface Session {
  db: Db;
  user: UserRow;
  /** هل الطلب مصادَق عليه فعلياً (false في وضع التطوير بلا مفاتيح)؟ */
  authenticated: boolean;
}

export type SessionResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

export async function requireSession(): Promise<SessionResult> {
  let requestUser;
  try {
    requestUser = await getRequestUser();
  } catch (error) {
    console.error(
      "session: Clerk request authentication failed",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, response: authServiceUnavailableResponse() };
  }
  if (!requestUser) {
    return { ok: false, response: unauthorizedResponse() };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, response: databaseNotConfiguredResponse() };
  }
  let db: Db | null;
  try {
    db = getDb();
  } catch (error) {
    console.error(
      "session: database connection failed",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, response: databaseUnavailableResponse() };
  }
  if (!db) {
    return { ok: false, response: databaseNotConfiguredResponse() };
  }
  let user: UserRow;
  try {
    user = await ensureUser(db, {
      clerkId: requestUser.clerkId,
      email: requestUser.email,
    });
  } catch (error) {
    console.error(
      "session: failed to load or create authenticated user",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, response: databaseUnavailableResponse() };
  }
  return {
    ok: true,
    session: { db, user, authenticated: requestUser.authenticated },
  };
}
