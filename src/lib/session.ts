import type { NextResponse } from "next/server";
import {
  databaseNotConfiguredResponse,
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
  const requestUser = await getRequestUser();
  if (!requestUser) {
    return { ok: false, response: unauthorizedResponse() };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, response: databaseNotConfiguredResponse() };
  }
  const db = getDb();
  if (!db) {
    return { ok: false, response: databaseNotConfiguredResponse() };
  }
  const user = await ensureUser(db, {
    clerkId: requestUser.clerkId,
    email: requestUser.email,
  });
  return {
    ok: true,
    session: { db, user, authenticated: requestUser.authenticated },
  };
}
