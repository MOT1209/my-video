import { z } from "zod";
import { DEFAULT_AR_VOICE } from "../../../../types/shorts";
import { executeApi } from "../../../helpers/api-response";
import { guardPaidRoute } from "../../../lib/auth";
import {
  checkRateLimit,
  clientIp,
  rateLimitRejection,
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
  const guard = await guardPaidRoute();
  if ("response" in guard) {
    return guard.response;
  }
  const verdict = await checkRateLimit(`script:${clientIp(req)}`, 6, 10 * 60 * 1000);
  if (!verdict.allowed) {
    return rateLimitRejection(verdict);
  }
  return handleScript(req);
};
