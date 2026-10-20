import { z } from "zod";
import { executeApi } from "../../../helpers/api-response";
import { guardPaidRoute } from "../../../lib/auth";
import {
  checkRateLimit,
  clientIp,
  rateLimitedResponse,
} from "../../../lib/rate-limit";
import {
  buildImagePrompt,
  generateBackgroundImage,
} from "../../../lib/background-images";

const ImageRequest = z.object({
  /** نص المشهد/الوصف — يُبنى منه برومبت الخلفية الصريح 9:16. */
  prompt: z.string().min(3).max(500),
  /** لزيادة الوضوح بشكل اختياري: جملة زيادة بأسلوب الصورة. */
  styleHint: z.string().max(200).optional(),
});

const handleImage = executeApi(ImageRequest, async (req, body) => {
  const prompt = buildImagePrompt(body.prompt);
  const { url, cached, hash } = await generateBackgroundImage({
    prompt: body.styleHint ? `${prompt} ${body.styleHint}` : prompt,
    blobToken: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return { url, cached, hash };
});

/** 8 صور لكل IP كل 10 دقائق (توليد صور مكلف نسبياً). */
export const POST = async (req: Request) => {
  const guard = await guardPaidRoute();
  if ("response" in guard) {
    return guard.response;
  }
  const verdict = await checkRateLimit(
    `image:${clientIp(req)}`,
    8,
    10 * 60 * 1000,
  );
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict.retryAfterSec);
  }
  return handleImage(req);
};
