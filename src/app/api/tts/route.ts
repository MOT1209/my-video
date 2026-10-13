import { z } from "zod";
import { DEFAULT_AR_VOICE } from "../../../../types/shorts";
import { executeApi } from "../../../helpers/api-response";
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

export const POST = executeApi(TtsRequest, async (_req, body) => {
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
