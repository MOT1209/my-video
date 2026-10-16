import { getRequestUser, unauthorizedResponse } from "../../../lib/auth";
import { apiError, apiSuccess } from "../../../helpers/api-response";
import { getDb } from "../../../lib/db/client";
import { ensureUser, recordUsage } from "../../../lib/db/repository";
import {
  checkRateLimit,
  clientIp,
  rateLimitedResponse,
} from "../../../lib/rate-limit";
import { transcribeAudio } from "../../../lib/transcribe";

/**
 * نسخ ملف صوتي مرفوع إلى نص + كابشن (بند ASR من المرحلة 2).
 * المصادقة تُفرض عند تفعيل Clerk، وتسجيل الاستهلاك غير حرج (لا يعطّل النسخ).
 */
export async function POST(req: Request) {
  const requestUser = await getRequestUser();
  if (!requestUser) {
    return unauthorizedResponse();
  }

  const subject = requestUser.authenticated
    ? `user:${requestUser.clerkId}`
    : `ip:${clientIp(req)}`;
  // النسخ مكلف نسبياً (صوت طويل = توكنات): 5 عمليات لكل موضوع كل 10 دقائق
  const verdict = await checkRateLimit(`transcribe:${subject}`, 5, 10 * 60 * 1000);
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict.retryAfterSec);
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return apiError("أرسل الطلب بصيغة multipart/form-data مع حقل audio.", 400);
  }
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return apiError("حقل audio مفقود أو ليس ملفاً.", 400);
  }

  const lang = form.get("lang") === "en" ? "en" : "ar";
  const rawDuration = Number(form.get("durationSec"));
  const durationSec =
    Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null;

  try {
    const result = await transcribeAudio({
      audio: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type || "audio/mpeg",
      lang,
      durationSec,
    });

    // الاستهلاك أفضل جهد: لا يُفشل النسخ إن تعذّر تسجيله
    const db = getDb();
    if (db) {
      try {
        const row = await ensureUser(db, {
          clerkId: requestUser.clerkId,
          email: requestUser.email,
        });
        await recordUsage(db, {
          userId: row.id,
          kind: "transcribe",
          units: 1,
          meta: { model: result.model, bytes: file.size },
        });
      } catch (err) {
        console.warn("transcribe: فشل تسجيل الاستهلاك", err);
      }
    }

    return apiSuccess({
      text: result.text,
      captions: result.captions,
      model: result.model,
    });
  } catch (err) {
    return apiError((err as Error).message || "تعذّر نسخ الملف الصوتي.", 502);
  }
}
