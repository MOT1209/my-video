import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DRAMA_PAIRED_TAGS,
  FISH_DRAMA3_MODEL,
  FISH_SCENE_MAX_CHARS,
  FISH_TTS_URL,
  requireFishKey,
  type DialogueTurn,
  type DramaPairedTag,
  type FishAudioFormat,
  type FishScene,
  type FishScenesAudioResult,
  type FishSceneAudioFile,
} from "./types";

export interface Drama3RequestOptions {
  apiKey?: string;
  /** صوت واحد أو مصفوفة أصوات (للحوار: فهرس الصوت = رقم <|speaker:N|>) */
  referenceId?: string | string[] | null;
  format?: FishAudioFormat;
  /** سرعة النطق 0.5–2.0 */
  speed?: number;
  timeoutMs?: number;
}

/**
 * طلب واحد إلى Fish Audio Drama 3.
 * الترويسة `model: drama-3` تُرسل دائماً من هنا — لا تمررها يدوياً.
 */
export async function synthesizeDrama3(
  text: string,
  opts: Drama3RequestOptions = {},
): Promise<Buffer> {
  const clean = text.trim();
  if (!clean) {
    throw new Error("نص Drama 3 فارغ");
  }
  if (clean.length > FISH_SCENE_MAX_CHARS) {
    throw new Error(
      `النص أطول من حد الطلب (${clean.length} > ${FISH_SCENE_MAX_CHARS}) — جزّئه بـ chunkTextForFish أولاً`,
    );
  }
  const apiKey = requireFishKey(opts.apiKey);
  const {
    referenceId = null,
    format = "mp3",
    speed,
    timeoutMs = 120000,
  } = opts;

  const body: Record<string, unknown> = { text: clean, format };
  if (referenceId) {
    body.reference_id = referenceId;
  }
  if (speed !== undefined) {
    body.prosody = { speed };
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(FISH_TTS_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // حرج: أي خطأ إملائي هنا يُسقط الطلب بصمت على s2.1-pro
          model: FISH_DRAMA3_MODEL,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const snippet = await res.text().catch(() => "");
        // أخطاء العميل (عدا 429) لا تستحق إعادة — 401 مفتاح خطأ، 402 رصيد
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(
            `Fish Audio رفض الطلب: HTTP ${res.status} — ${snippet.slice(0, 200)}`,
          );
        }
        throw new Error(`Fish Audio: HTTP ${res.status} — ${snippet.slice(0, 200)}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err as Error;
      if (lastError.message.includes("رفض الطلب")) {
        throw lastError;
      }
      await sleep(attempt * 2000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`فشل توليد الصوت بعد 3 محاولات (${lastError?.message ?? "unknown"})`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * تقسيم نص (عربي/إنجليزي) إلى قطع ≤ maxChars على حدود الجمل أولاً
 * (؟ ? ! . … والسطور)، ثم على حدود الكلمات. دالة خالصة — تُختبر بدون شبكة.
 */
export function chunkTextForFish(
  text: string,
  maxChars: number = FISH_SCENE_MAX_CHARS,
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return [];
  }
  if (clean.length <= maxChars) {
    return [clean];
  }
  const sentences = clean
    .split(/(?<=[.!?؟…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);

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
  return chunks.map((c) => c.slice(0, maxChars));
}

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

/**
 * تغليف كلمات محددة بوسم مزدوج — يؤثر على الكلمات المحصورة فقط.
 * مثال: wrapPairedTag("Go on without me", "whisper")
 * → "<whisper>Go on without me</whisper>"
 */
export function wrapPairedTag(words: string, tag: DramaPairedTag): string {
  if (!DRAMA_PAIRED_TAGS.includes(tag)) {
    throw new Error(`وسم Drama 3 غير مدعوم: ${tag}`);
  }
  const clean = words.trim();
  if (!clean) {
    throw new Error("لا كلمات لتغليفها بالوسم");
  }
  return `<${tag}>${clean}</${tag}>`;
}

/**
 * إضافة توجيه أداء بلغة طبيعية (عربي أو إنجليزي) قبل الجملة.
 * مثال: addDirection("أنا بخير", "بصوت مكسور يكتم البكاء")
 * → "[بصوت مكسور يكتم البكاء] أنا بخير"
 */
export function addDirection(text: string, direction: string): string {
  const t = text.trim();
  const d = direction.trim().replace(/^\[|\]$/g, "").trim();
  if (!t) {
    throw new Error("النص فارغ — لا يمكن توجيهه");
  }
  if (!d) {
    return t;
  }
  return `[${d}] ${t}`;
}

/**
 * بناء نص حوار متعدد المتحدثين: كل منعطف يُسبق بوسم <|speaker:N|>
 * حيث N = فهرس صوت المتحدث في مصفوفة reference_id.
 */
export function buildDialogue(turns: DialogueTurn[]): string {
  if (turns.length === 0) {
    throw new Error("لا منعطفات لبناء الحوار");
  }
  return turns
    .map((t) => {
      const body = t.direction ? addDirection(t.text, t.direction) : t.text.trim();
      return `<|speaker:${t.speaker}|>${body}`;
    })
    .join("");
}

export interface SynthesizeScenesOptions extends Drama3RequestOptions {
  /** توجيه أداء اختياري يُحقن في كل مشهد (string واحد أو لكل مشهد) */
  direction?: string | string[];
  /** مجلد الإخراج — الافتراضي التخزين المؤقت للنظام */
  outDir?: string;
}

/**
 * توليد صوت Drama 3 لكل مشهد وحفظه متزامناً مع المشاهد:
 * <tmp>/fish-drama3/<hash>/{s1.mp3, s2.wav, ..., manifest.json}
 *
 * ملاحظة: لا دمج تلقائي — ملفات mp3 لا تُدمج بترابط باينري آمن
 * بدون ffmpeg. المشغّل/المركّب يقرأ manifest.json ويرتب المشاهد.
 */
export async function synthesizeScenesAudio(
  scenes: Pick<FishScene, "id" | "text">[],
  opts: SynthesizeScenesOptions = {},
): Promise<FishScenesAudioResult> {
  const { direction, outDir, ...reqOpts } = opts;
  const format = reqOpts.format ?? "mp3";
  const ext = format === "wav" ? "wav" : format === "opus" ? "opus" : "mp3";
  const apiKey = requireFishKey(reqOpts.apiKey);

  if (scenes.length === 0) {
    throw new Error("لا توجد مشاهد لتوليد الصوت لها");
  }
  const directions = Array.isArray(direction)
    ? direction
    : scenes.map(() => direction ?? null);
  if (directions.length !== scenes.length) {
    throw new Error("عدد التوجيهات لا يطابق عدد المشاهد");
  }

  const directed = scenes.map((s, i) =>
    directions[i] ? addDirection(s.text, directions[i] as string) : s.text,
  );

  const hash = createHash("sha256")
    .update(`${FISH_DRAMA3_MODEL}::${JSON.stringify(reqOpts.referenceId ?? null)}::${directed.join("\n")}`)
    .digest("hex")
    .slice(0, 16);
  const dir = outDir ?? join(tmpdir(), "fish-drama3", hash);
  await mkdir(dir, { recursive: true });

  const files: FishSceneAudioFile[] = [];
  for (let i = 0; i < scenes.length; i++) {
    // المشهد الواحد ≤ 280 حرف عادةً = طلب واحد؛ الطويل يُجزأ ويُؤخذ أول قطعة
    // (الأفضل: أعد صياغة المشهد الطويل بدل تقسيم الصوت)
    const chunks = chunkTextForFish(directed[i]);
    if (chunks.length === 0) {
      throw new Error(`المشهد ${scenes[i].id} نصه فارغ`);
    }
    if (chunks.length > 1) {
      throw new Error(
        `المشهد ${scenes[i].id} يتجاوز حد الطلب بعد التوجيه — قصّره قبل التوليد`,
      );
    }
    const audio = await synthesizeDrama3(chunks[0], { ...reqOpts, apiKey });
    const fileName = `${scenes[i].id}.${ext}`;
    const filePath = join(dir, fileName);
    await writeFile(filePath, new Uint8Array(audio));
    files.push({
      sceneId: scenes[i].id,
      text: scenes[i].text,
      directedText: directed[i],
      fileName,
      filePath,
      totalBytes: audio.length,
    });
  }

  const manifestPath = join(dir, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        model: FISH_DRAMA3_MODEL,
        referenceId: reqOpts.referenceId ?? null,
        format,
        createdAt: new Date().toISOString(),
        scenes: files.map((f) => ({
          sceneId: f.sceneId,
          file: f.fileName,
          text: f.text,
          directedText: f.directedText,
          totalBytes: f.totalBytes,
        })),
      },
      null,
      2,
    ),
  );

  return {
    dir,
    manifestPath,
    model: FISH_DRAMA3_MODEL,
    referenceId: reqOpts.referenceId ?? null,
    scenes: files,
  };
}
