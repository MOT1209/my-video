import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_GROQ_ARABIC_VOICE,
  GROQ_ARABIC_TTS_MODEL,
  GROQ_TTS_MAX_CHARS,
  GROQ_TTS_URL,
  requireGroqKey,
  type GroqArabicVoiceId,
  type GroqScene,
  type ScenesAudioResult,
  type SceneAudioFile,
} from "./types";

export interface SynthesizeScenesOptions {
  apiKey?: string;
  voice?: GroqArabicVoiceId;
  model?: string;
  /** إنتاج combined.wav مدمج لكل المشاهد — الافتراضي true */
  combine?: boolean;
  /** مجلد الإخراج — الافتراضي التخزين المؤقت للنظام */
  outDir?: string;
  timeoutMs?: number;
}

/**
 * تقسيم نص عربي إلى قطع ≤ maxChars على حدود الجمل أولاً
 * (؟ ! . … والسطور)، ثم على حدود الكلمات عند الضرورة.
 * الضمان: كل قطعة مرجعة طولها ≤ maxChars (بعد القص).
 * دالة خالصة — تُختبر بدون شبكة.
 */
export function chunkTextForTts(
  text: string,
  maxChars: number = GROQ_TTS_MAX_CHARS,
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return [];
  }
  if (clean.length <= maxChars) {
    return [clean];
  }

  // 1) تقسيم إلى جمل مع إبقاء علامة الترقيم
  const sentences = clean
    .split(/(?<=[.!?؟…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  // 2) تعبئة جشعة للجمل في قطع
  const chunks: string[] = [];
  let current = "";
  const push = (c: string) => {
    const t = c.trim();
    if (t) {
      chunks.push(t);
    }
  };
  for (const s of sentences) {
    if (s.length > maxChars) {
      // جملة أطول من الحد: قسّمها على الكلمات
      push(current);
      current = "";
      for (const w of splitLongSentence(s, maxChars)) {
        push(w);
      }
      continue;
    }
    const candidate = current ? `${current} ${s}` : s;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      push(current);
      current = s;
    }
  }
  push(current);

  // 3) ضمان صارم: أي قطعة فلتت تُقصّ
  return chunks.map((c) => c.slice(0, maxChars));
}

/** تقسيم جملة طويلة على حدود الكلمات (ثم قصّ صارم للكلمة الشاذة) */
function splitLongSentence(sentence: string, maxChars: number): string[] {
  const words = sentence.split(" ").filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (w.length > maxChars) {
      if (cur.trim()) {
        out.push(cur.trim());
        cur = "";
      }
      for (let i = 0; i < w.length; i += maxChars) {
        out.push(w.slice(i, i + maxChars));
      }
      continue;
    }
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length <= maxChars) {
      cur = cand;
    } else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur.trim()) {
    out.push(cur.trim());
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** طلب صوتي واحد (نصه ≤ 200 حرف) مع إعادة محاولة 3 مرات */
export async function synthesizeChunk(input: {
  text: string;
  voice: GroqArabicVoiceId;
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}): Promise<Buffer> {
  const { text, voice, apiKey, model = GROQ_ARABIC_TTS_MODEL, timeoutMs = 90000 } =
    input;
  if (!text.trim()) {
    throw new Error("نص القطعة الصوتية فارغ");
  }
  if (text.length > GROQ_TTS_MAX_CHARS) {
    throw new Error(
      `القطعة أطول من حد النموذج (${text.length} > ${GROQ_TTS_MAX_CHARS}) — استخدم chunkTextForTts أولاً`,
    );
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(GROQ_TTS_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          voice,
          input: text,
          response_format: "wav",
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // أخطاء العميل (4xx عدا 429) لا تستحق إعادة
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(`Groq TTS رفض الطلب: HTTP ${res.status} — ${body.slice(0, 200)}`);
        }
        throw new Error(`Groq TTS: HTTP ${res.status} — ${body.slice(0, 200)}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err as Error;
      if (
        lastError.message.includes("رفض الطلب") ||
        lastError.message.includes("أطول من حد النموذج")
      ) {
        throw lastError;
      }
      await sleep(attempt * 2000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`فشل توليد الصوت بعد 3 محاولات (${lastError?.message ?? "unknown"})`);
}

interface WavFormat {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  fmtBytes: Buffer;
  dataOffset: number;
  dataLength: number;
}

/** قراءة ترويسة WAV والتحقق من سلامتها */
function parseWav(buf: Buffer): WavFormat {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("الملف ليس WAV صالحاً (ترويسة RIFF/WAVE مفقودة)");
  }
  let offset = 12;
  let fmtBytes: Buffer | null = null;
  let dataOffset = -1;
  let dataLength = -1;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      fmtBytes = buf.subarray(offset + 8, offset + 8 + size);
    } else if (id === "data") {
      dataOffset = offset + 8;
      dataLength = size;
      break; // بيانات الصوت — نتوقف هنا
    }
    offset += 8 + size + (size % 2); // محاذاة لكلمتين
  }
  if (!fmtBytes || dataOffset === -1) {
    throw new Error("ملف WAV ناقص (لا يحتوي fmt/data)");
  }
  return {
    audioFormat: fmtBytes.readUInt16LE(0),
    channels: fmtBytes.readUInt16LE(2),
    sampleRate: fmtBytes.readUInt32LE(4),
    bitsPerSample: fmtBytes.readUInt16LE(14),
    fmtBytes,
    dataOffset,
    dataLength: Math.min(dataLength, buf.length - dataOffset),
  };
}

/**
 * دمج ملفات WAV متطابقة التنسيق في ملف واحد.
 * يرفض الدمج عند اختلاف القنوات/معدل العينات/البت برسالة واضحة.
 */
export function concatWav(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) {
    throw new Error("لا توجد ملفات صوتية للدمج");
  }
  if (buffers.length === 1) {
    parseWav(buffers[0]); // تحقق من الترويسة حتى للملف المفرد
    return buffers[0];
  }
  const parsed = buffers.map(parseWav);
  const [first, ...rest] = parsed;
  for (const p of rest) {
    if (
      p.audioFormat !== first.audioFormat ||
      p.channels !== first.channels ||
      p.sampleRate !== first.sampleRate ||
      p.bitsPerSample !== first.bitsPerSample
    ) {
      throw new Error(
        `تنسيقات WAV غير متطابقة — لا يمكن الدمج ` +
          `(${first.channels}ch/${first.sampleRate}Hz/${first.bitsPerSample}bit مقابل ` +
          `${p.channels}ch/${p.sampleRate}Hz/${p.bitsPerSample}bit)`,
      );
    }
  }

  const dataParts = parsed.map((p, i) =>
    buffers[i].subarray(p.dataOffset, p.dataOffset + p.dataLength),
  );
  const data = Buffer.concat(dataParts);
  // ترويسة جديدة: RIFF + size + WAVE + fmt + data
  const header = Buffer.alloc(12 + 8 + first.fmtBytes.length + 8);
  header.write("RIFF", 0);
  header.writeUInt32LE(header.length + data.length - 8, 4);
  header.write("WAVE", 8);
  let o = 12;
  header.write("fmt ", o);
  header.writeUInt32LE(first.fmtBytes.length, o + 4);
  first.fmtBytes.copy(header, o + 8);
  o += 8 + first.fmtBytes.length;
  header.write("data", o);
  header.writeUInt32LE(data.length, o + 4);
  return Buffer.concat([header, data]);
}

/**
 * توليد صوت كل مشهد (مجزأً حسب حد 200 حرف) وحفظه متزامناً مع المشاهد
 * في التخزين المؤقت: <tmp>/groq-shorts/<hash>/{s1.wav, s2.wav, ..., manifest.json}
 */
export async function synthesizeScenesAudio(
  scenes: Pick<GroqScene, "id" | "text">[],
  opts: SynthesizeScenesOptions = {},
): Promise<ScenesAudioResult> {
  const {
    voice = DEFAULT_GROQ_ARABIC_VOICE,
    model = GROQ_ARABIC_TTS_MODEL,
    combine = true,
    timeoutMs,
  } = opts;
  const apiKey = requireGroqKey(opts.apiKey);

  if (scenes.length === 0) {
    throw new Error("لا توجد مشاهد لتوليد الصوت لها");
  }

  const hash = createHash("sha256")
    .update(`${model}::${voice}::${scenes.map((s) => s.text).join("\n")}`)
    .digest("hex")
    .slice(0, 16);
  const dir = opts.outDir ?? join(tmpdir(), "groq-shorts", hash);
  await mkdir(dir, { recursive: true });

  const sceneFiles: SceneAudioFile[] = [];
  const sceneWavs: Buffer[] = [];

  for (const scene of scenes) {
    const chunks = chunkTextForTts(scene.text);
    if (chunks.length === 0) {
      throw new Error(`المشهد ${scene.id} نصه فارغ`);
    }
    const wavs: Buffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      wavs.push(
        await synthesizeChunk({ text: chunks[i], voice, apiKey, model, timeoutMs }),
      );
    }
    const sceneWav = concatWav(wavs);
    const fileName = `${scene.id}.wav`;
    const filePath = join(dir, fileName);
    await writeFile(filePath, new Uint8Array(sceneWav));

    sceneFiles.push({
      sceneId: scene.id,
      text: scene.text,
      fileName,
      filePath,
      chunks: chunks.map((c, i) => ({ index: i, chars: c.length })),
      totalBytes: sceneWav.length,
    });
    sceneWavs.push(sceneWav);
  }

  let combinedWavPath: string | null = null;
  if (combine) {
    const combined = concatWav(sceneWavs);
    combinedWavPath = join(dir, "combined.wav");
    await writeFile(combinedWavPath, new Uint8Array(combined));
  }

  const manifestPath = join(dir, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        voice,
        model,
        createdAt: new Date().toISOString(),
        combined: combinedWavPath ? "combined.wav" : null,
        scenes: sceneFiles.map((s) => ({
          sceneId: s.sceneId,
          file: s.fileName,
          text: s.text,
          chunks: s.chunks,
          totalBytes: s.totalBytes,
        })),
      },
      null,
      2,
    ),
  );

  return { dir, manifestPath, voice, model, scenes: sceneFiles, combinedWavPath };
}
