import { guardPaidRoute } from "../../../lib/auth";
import { apiError, apiSuccess } from "../../../helpers/api-response";
import { getDb } from "../../../lib/db/client";
import { ensureUser, recordUsage } from "../../../lib/db/repository";
import {
  checkRateLimit,
  clientIp,
  rateLimitRejection,
} from "../../../lib/rate-limit";
import { MAX_AUDIO_BYTES, transcribeAudio } from "../../../lib/transcribe";

/** هامش ترويسات multipart فوق حد الملف الصوتي نفسه. */
const MAX_TRANSCRIBE_BODY_BYTES = MAX_AUDIO_BYTES + 64 * 1024;

/**
 * نسخ ملف صوتي مرفوع إلى نص + كابشن (بند ASR من المرحلة 2).
 * المصادقة تُفرض عند تفعيل Clerk، وتسجيل الاستهلاك غير حرج (لا يعطّل النسخ).
 */
export async function POST(req: Request) {
  const guard = await guardPaidRoute();
  if ("response" in guard) {
    return guard.response;
  }
  const requestUser = guard.user;

  const subject = requestUser.authenticated
    ? `user:${requestUser.clerkId}`
    : `ip:${clientIp(req)}`;
  // النسخ مكلف نسبياً (صوت طويل = توكنات): 5 عمليات لكل موضوع كل 10 دقائق
  const verdict = await checkRateLimit(`transcribe:${subject}`, 5, 10 * 60 * 1000);
  if (!verdict.allowed) {
    return rateLimitRejection(verdict);
  }

  // رفض مبكر قبل قراءة الجسم في الذاكرة (formData تُحمّل الملف كاملاً)
  if (Number(req.headers.get("content-length") ?? 0) > MAX_TRANSCRIBE_BODY_BYTES) {
    return apiError("الملف الصوتي أكبر من الحد المسموح (15MB).", 413);
  }
  const form = await req.formData().catch(() => null);
  if (!form) {
    return apiError("أرسل الطلب بصيغة multipart/form-data مع حقل audio.", 400);
  }
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return apiError("حقل audio مفقود أو ليس ملفاً.", 400);
  }
  if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
    return apiError("حجم الملف الصوتي فارغ أو يتجاوز 15 ميجابايت.", 413);
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
    // رسائل transcribeAudio عربية من صنعنا (بلا نص رد المزوّد) — آمنة للعرض
    console.error("transcribe: فشل النسخ", (err as Error)?.message);
    return apiError((err as Error)?.message || "تعذّر نسخ الملف الصوتي.", 502);
  }
}
