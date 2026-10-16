import { apiError, apiSuccess } from "../../../../helpers/api-response";
import { deleteProject, getProject } from "../../../../lib/db/repository";
import { requireSession } from "../../../../lib/session";

/**
 * مشروع واحد: قراءة الحالة الكاملة (لتحميلها في المحرّر) أو حذف.
 * الملكية مفروضة في استعلامات المستودع نفسها — معرّف مشروع مستخدم آخر
 * لا يُعيد بيانات ولا يحذف.
 */

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireSession();
  if (!guard.ok) {
    return guard.response;
  }
  const { db, user } = guard.session;
  const { id } = await ctx.params;

  const row = await getProject(db, user.id, id);
  if (!row) {
    return apiError("المشروع غير موجود أو لا يخصّ حسابك.", 404);
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

  const deleted = await deleteProject(db, user.id, id);
  if (!deleted) {
    return apiError("المشروع غير موجود أو لا يخصّ حسابك.", 404);
  }
  return apiSuccess({ id });
}
