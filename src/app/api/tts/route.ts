import { z } from "zod";
import { DEFAULT_AR_VOICE } from "../../../../types/shorts";
import { apiError, executeApi } from "../../../helpers/api-response";
import { guardPaidRoute } from "../../../lib/auth";
import {
  checkRateLimit,
  clientIp,
  rateLimitRejection,
} from "../../../lib/rate-limit";
import {
  getCachedAudio,
  hashNarration,
  putAudioCache,
  synthesizeNarration,
} from "../../../lib/tts";

const TtsRequest = z.object({
  text: z.string().min(1).max(1200),
  voiceId: z.string().min(1).max(120).default(DEFAULT_AR_VOICE),
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

/** 20 طلب صوت لكل IP كل 5 دقائق (حماية قبل النشر العام). */
export const POST = async (req: Request) => {
  // Azure TTS مدفوع، والرفع إلى Blob يستهلك تخزيناً.
  const guard = await guardPaidRoute();
  if ("response" in guard) return guard.response;
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return apiError("أرسل الطلب بصيغة application/json.", 415);
  }
  const user = guard.user;
  const subject = user.authenticated ? `user:${user.clerkId}` : `ip:${clientIp(req)}`;
  const verdict = await checkRateLimit(`tts:${subject}`, 20, 5 * 60 * 1000);
  if (!verdict.allowed) {
    return rateLimitRejection(verdict);
  }
  return handleTts(req);
};
