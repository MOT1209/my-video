import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BlobAccessError, head, put } from "@vercel/blob";
import {
  distributeCaptionsEvenly,
  SHORT_MAX_SECONDS,
  type WordCaption,
} from "../../types/shorts";
import { synthesizeWithWordBoundaries } from "./edge-tts";

/** حد الحماية: نص أطول من هذا يُرفض قبل طلب TTS */
export const MAX_TTS_CHARS = 1000;

export interface NarrationResult {
  audio: Buffer;
  captions: WordCaption[];
  durationSec: number;
  hash: string;
}

export function hashNarration(text: string, voiceId: string): string {
  return createHash("sha256").update(`${voiceId}::${text}`).digest("hex").slice(0, 32);
}

const audioKey = (hash: string) => `shorts-audio/${hash}.mp3`;
const metaKey = (hash: string) => `shorts-audio/${hash}.json`;

interface AudioMeta {
  captions: WordCaption[];
  durationSec: number;
  audioUrl: string;
}

/**
 * توليد التعليق الصوتي عبر Edge-TTS المجاني.
 * يرجع mp3 + كابشن بمستوى الكلمة + المدة.
 */
export async function synthesizeNarration(input: {
  text: string;
  voiceId: string;
}): Promise<NarrationResult> {
  const text = input.text.trim();
  if (!text) {
    throw new Error("النص فارغ — أدخل Hook ومشهداً واحداً على الأقل");
  }
  if (text.length > MAX_TTS_CHARS) {
    throw new Error(
      `النص طويل (${text.length} حرف). الحد ${MAX_TTS_CHARS} حرف لتبقى ضمن 60 ثانية`,
    );
  }

  const hash = hashNarration(text, input.voiceId);

  // Edge-TTS قد يرفض الاتصال مؤقتاً (403/429 حسب الشبكة) — نعيد المحاولة
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { audio, captions, durationSec } = await synthesizeWithWordBoundaries(
        text,
        input.voiceId,
      );
      if (audio.length === 0) {
        throw new Error("empty-audio");
      }
      if (captions.length === 0) {
        const estimated = Math.min(audio.length / 6000, SHORT_MAX_SECONDS);
        return {
          audio,
          captions: distributeCaptionsEvenly(text, estimated),
          durationSec: Number(estimated.toFixed(3)),
          hash,
        };
      }
      const capped = Math.min(durationSec, SHORT_MAX_SECONDS);
      const kept = captions.filter((c) => c.start < capped);
      return { audio, captions: kept, durationSec: capped, hash };
    } catch (err) {
      lastError = err as Error;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }

  throw new Error(
    "تعذر الاتصال بخدمة التعليق الصوتي من هذه الشبكة. تحقق من الإنترنت وأعد المحاولة بعد دقيقة. " +
      `(${(lastError as Error)?.message ?? "unknown"})`,
  );
}

/** يبحث في الكاش (Blob ثم محلي) قبل التوليد */
export async function getCachedAudio(
  hash: string,
  blobToken?: string,
): Promise<AudioMeta | null> {
  if (blobToken) {
    try {
      const meta = await head(metaKey(hash), { token: blobToken });
      const res = await fetch(meta.url);
      if (res.ok) {
        return (await res.json()) as AudioMeta;
      }
    } catch {
      // غير موجود — نتابع للتوليد
    }
  }

  const localMeta = join(process.cwd(), "public", "audio", `${hash}.json`);
  if (existsSync(localMeta)) {
    try {
      return JSON.parse(readFileSync(localMeta, "utf8")) as AudioMeta;
    } catch {
      return null;
    }
  }
  return null;
}

/** يحفظ الصوت + الكابشن في Blob (إن توفر) وإلا محلياً، ويرجع رابط الصوت */
export async function putAudioCache(
  result: NarrationResult,
  blobToken?: string,
): Promise<AudioMeta> {
  const meta: AudioMeta = {
    captions: result.captions,
    durationSec: result.durationSec,
    audioUrl: "",
  };

  if (blobToken) {
    try {
      const audioBlobBody = new Blob([new Uint8Array(result.audio)], {
        type: "audio/mpeg",
      });
    const [audioBlob] = await Promise.all([
      put(audioKey(result.hash), audioBlobBody, {
        access: "public",
        contentType: "audio/mpeg",
        addRandomSuffix: false,
        token: blobToken,
      }),
      put(
        metaKey(result.hash),
        JSON.stringify({ ...meta, audioUrl: "" }),
        {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
          token: blobToken,
        },
      ),
    ]);
    meta.audioUrl = audioBlob.url;
    // حدّث sidecar برابط الصوت النهائي
    await put(metaKey(result.hash), JSON.stringify(meta), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      token: blobToken,
    });
    return meta;
  } catch (err) {
    if (err instanceof BlobAccessError) {
      throw new Error(
        "مخزن Blob خاص (private) والتطبيق يحتاج رفعاً عاماً. من Vercel Dashboard افتح Storage ثم إعدادات الـ Blob store واسمح بالوصول العام ثم أعد النشر.",
      );
    }
    throw err;
  }
  }

  const dir = join(process.cwd(), "public", "audio");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${result.hash}.mp3`), new Uint8Array(result.audio));
  meta.audioUrl = `/audio/${result.hash}.mp3`;
  writeFileSync(join(dir, `${result.hash}.json`), JSON.stringify(meta));
  return meta;
}
