import { z } from "zod";
import { apiError, apiSuccess } from "../../../../helpers/api-response";
import { deleteProject, getProject } from "../../../../lib/db/repository";
import { requireSession } from "../../../../lib/session";

/**
 * مشروع واحد: قراءة الحالة الكاملة (لتحميلها في المحرّر) أو حذف.
 * الملكية مفروضة في استعلامات المستودع نفسها — معرّف مشروع مستخدم آخر
 * لا يُعيد بيانات ولا يحذف.
 */

type RouteContext = { params: Promise<{ id: string }> };

/** معرّف غير UUID يُعامل كغير موجود (404) بدل خطأ Postgres يُسقط الطلب 500. */
const ProjectId = z.string().uuid();
const NOT_FOUND = "المشروع غير موجود أو لا يخصّ حسابك.";

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) {
    return guard.response;
  }
  const { db, user } = guard.session;
  const { id } = await ctx.params;
  if (!ProjectId.safeParse(id).success) {
    return apiError(NOT_FOUND, 404);
  }

  const row = await getProject(db, user.id, id);
  if (!row) {
    return apiError(NOT_FOUND, 404);
  }
  return apiSuccess({
    id: row.id,
    title: row.title,
    props: row.props,
    updatedAt: row.updatedAt,
  });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) {
    return guard.response;
  }
  const { db, user } = guard.session;
  const { id } = await ctx.params;
  if (!ProjectId.safeParse(id).success) {
    return apiError(NOT_FOUND, 404);
  }

  const deleted = await deleteProject(db, user.id, id);
  if (!deleted) {
    return apiError(NOT_FOUND, 404);
  }
  return apiSuccess({ id });
}
