import { z } from "zod";
import { getRequestUser, unauthorizedResponse } from "../../../lib/auth";
import { DEFAULT_AR_VOICE } from "../../../../types/shorts";
import { apiError, executeApi } from "../../../helpers/api-response";
import {
  checkRateLimit,
  clientIp,
  rateLimitUnavailableResponse,
  rateLimitedResponse,
} from "../../../lib/rate-limit";
import { generateScript } from "../../../lib/script-generator";

const ScriptRequest = z
  .object({
    /** رابط مقال/موضوع — أحدهما على الأقل (مع topic كنسخة بديلة). */
    url: z.string().url().optional(),
    topic: z.string().min(3).max(500).optional(),
    lang: z.enum(["ar", "en"]).default("ar"),
    voiceId: z.string().min(1).max(120).default(DEFAULT_AR_VOICE),
  })
  .refine((body) => Boolean(body.url ?? body.topic), {
    message: "يجب تمرير رابط مقال أو موضوع",
  });

const handleScript = executeApi(ScriptRequest, async (req, body) => {
  const { hook, scenes } = await generateScript({
    url: body.url,
    topic: body.topic,
    lang: body.lang,
  });
  return {
    hook,
    scenes,
    voiceId: body.voiceId,
    lang: body.lang,
  };
});

/** 6 طلبات سكربت لكل IP كل 10 دقائق (LLM مكلف نسبياً). */
export const POST = async (req: Request) => {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return apiError("أرسل الطلب بصيغة application/json.", 415);
  }

  const subject = user.authenticated ? `user:${user.clerkId}` : `ip:${clientIp(req)}`;
  const verdict = await checkRateLimit(`script:${subject}`, 6, 10 * 60 * 1000);
  if (verdict.unavailable) return rateLimitUnavailableResponse();
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict.retryAfterSec);
  }
  return handleScript(req);
};
