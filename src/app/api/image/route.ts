import { z } from "zod";
import { apiError, executeApi } from "../../../helpers/api-response";
import { guardPaidRoute } from "../../../lib/auth";
import {
  checkRateLimit,
  clientIp,
  rateLimitRejection,
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
  if ("response" in guard) return guard.response;
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return apiError("أرسل الطلب بصيغة application/json.", 415);
  }
  const user = guard.user;
  const subject = user.authenticated ? `user:${user.clerkId}` : `ip:${clientIp(req)}`;
  const verdict = await checkRateLimit(
    `image:${subject}`,
    8,
    10 * 60 * 1000,
  );
  if (!verdict.allowed) {
    return rateLimitRejection(verdict);
  }
  return handleImage(req);
};
