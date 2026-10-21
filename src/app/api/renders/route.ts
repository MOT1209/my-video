import { apiError, apiSuccess } from "../../../helpers/api-response";
import { listRenders } from "../../../lib/db/repository";
import { requireSession } from "../../../lib/session";

/** سجل تصييرات المستخدم (الأحدث أولاً) — أساس «إعادة التنزيل». */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) {
    return guard.response;
  }
  const { db, user } = guard.session;

  const rawLimit = new URL(req.url).searchParams.get("limit");
  const raw = rawLimit === null ? 20 : Number(rawLimit);
  if (!Number.isInteger(raw) || raw < 1 || raw > 100) {
    return apiError("قيمة limit يجب أن تكون عدداً صحيحاً بين 1 و100.", 400);
  }
  const limit = raw;

  const rows = await listRenders(db, user.id, limit);
  return apiSuccess({
    renders: rows.map((row) => ({
      id: row.id,
      compositionId: row.compositionId,
      status: row.status,
      url: row.url,
      sizeBytes: row.sizeBytes,
      sandboxMs: row.sandboxMs,
      creditsUsed: row.creditsUsed,
      attempts: row.attempts,
      error: row.error,
      createdAt: row.createdAt,
    })),
  });
}
