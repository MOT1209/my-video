import { z } from "zod";
import { DEFAULT_AR_VOICE, VoiceId } from "../../../../types/shorts";
import { executeApi } from "../../../helpers/api-response";
import { guardPaidRoute } from "../../../lib/auth";
import {
  checkRateLimit,
  rateLimitRejection,
  rateLimitSubject,
} from "../../../lib/rate-limit";
import {
  getCachedAudio,
  hashNarration,
  MAX_TTS_CHARS,
  putAudioCache,
  synthesizeNarration,
} from "../../../lib/tts";

const TtsRequest = z.object({
  // نفس حد المكتبة: نص أطول كان يمر من المخطط ثم يسقط 500 داخل synthesizeNarration
  text: z.string().min(1).max(MAX_TTS_CHARS),
  voiceId: VoiceId.default(DEFAULT_AR_VOICE),
});

const handleTts = executeApi(TtsRequest, async (_req, body) => {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const hash = hashNarration(body.text.trim(), body.voiceId);

  const cached = await getCachedAudio(hash, blobToken);
  if (cached) {
    return { ...cached, hash, cached: true };
  }

  const result = await synthesizeNarration({ text: body.text, voiceId: body.voiceId });
  const meta = await putAudioCache(result, blobToken);
  return { ...meta, hash, cached: false };
});

/** 20 طلب صوت لكل مستخدم (أو IP بلا حساب) كل 5 دقائق (حماية قبل النشر العام). */
export const POST = async (req: Request) => {
  // نفس بوابة المسارات المكلفة: Azure TTS مدفوع، والرفع إلى Blob يستهلك تخزيناً
  const guard = await guardPaidRoute();
  if ("response" in guard) {
    return guard.response;
  }
  const verdict = await checkRateLimit(`tts:${rateLimitSubject(req, guard.user)}`, 20, 5 * 60 * 1000);
  if (!verdict.allowed) {
    return rateLimitRejection(verdict);
  }
  return handleTts(req);
};
