import { z } from "zod";
import { ShortProps } from "../../../../types/shorts";
import { apiError, apiSuccess } from "../../../helpers/api-response";
import { listProjects, PROJECT_NOT_FOUND, saveProject } from "../../../lib/db/repository";
import { requireSession } from "../../../lib/session";

/**
 * مشاريع المستخدم (المرحلة 4).
 * - `GET` يُعيد بيانات وصفية فقط (بلا `props`): قائمة من 50 مشروعاً قد
 *   تحمل لكل مشروع مئات الكابشنات، فلا تُحمَّل كلها لعرض قائمة.
 * - `POST` يحفظ (يُدرج أو يُحدّث) — الحالة الكاملة تُقرأ من `/api/projects/[id]`.
 */

const ProjectSaveRequest = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  props: ShortProps,
});

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) {
    return guard.response;
  }
  const { db, user } = guard.session;
  const rows = await listProjects(db, user.id);
  return apiSuccess({
    projects: rows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt,
    })),
  });
}

export async function POST(req: Request) {
  const guard = await requireSession();
  if (!guard.ok) {
    return guard.response;
  }
  const { db, user } = guard.session;

  const parsed = ProjectSaveRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError("بيانات المشروع غير صالحة: تحقّق من العنوان والمشاهد.", 400);
  }

  try {
    const saved = await saveProject(db, {
      userId: user.id,
      id: parsed.data.id ?? null,
      title: parsed.data.title,
      props: parsed.data.props,
    });
    return apiSuccess({
      id: saved.id,
      title: saved.title,
      updatedAt: saved.updatedAt,
    });
  } catch (err) {
    if ((err as Error)?.message === PROJECT_NOT_FOUND) {
      return apiError("المشروع غير موجود أو لا يخصّ حسابك.", 404);
    }
    console.error("projects: فشل الحفظ", err);
    return apiError("تعذّر حفظ المشروع.", 500);
  }
}
