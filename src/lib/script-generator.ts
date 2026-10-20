import * as cheerio from "cheerio";
import { z } from "zod";

/**
 * توليد سكربت من رابط/مقال — المرحلة 2 من الخطة:
 * ‏POST /api/script → { url|topic } → { hook, scenes } متوافق مع ShortScene.
 *
 * - الاستخراج: ‏fetch + cheerio (يعتمد الوسائل القوية: article/main ثم body،
 *   ويقشّط سكريبتات/أنماط/ترويسات/تذييلات).
 * - النموذج: Gemini عبر REST صريح (generateContent + رد JSON إجباري).
 *   المفاتيح على الخادم فقط (process.env) — لا تدخل حزمة العميل.
 *   اسم النموذج قابل للتجّوز عبر GEMINI_MODEL (يتغيّر بمرور الوقت).
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** الحد الأقصى لنص المقال المُرسل للنموذج (توفير توكنات). */
const MAX_ARTICLE_CHARS = 15_000;

// مخطط الرد مع نماذج قابلة للحقن في الاختبارات بلا شبكة
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const ScriptResponse = z
  .object({
    hook: z.string().min(1).max(160),
    scenes: z.array(z.string().min(1).max(280)).min(1).max(10),
  })
  .strict();
export type ScriptResponse = z.infer<typeof ScriptResponse>;

/** يستخرج نصاً مجرداً من صفحة HTML — يعرض أفضله في article/main. */
export function extractArticleText(html: string, maxChars = MAX_ARTICLE_CHARS): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, aside, form, iframe")
    .remove();
  const preferred = $("article").text() || $("main").text() || $("body").text();
  const cleaned = preferred.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    throw new Error("لم يتم العثور على نص مقروء في الصفحة.");
  }
  return cleaned.slice(0, maxChars);
}

function buildPrompt(text: string, lang: "ar" | "en"): string {
  if (lang === "ar") {
    return `حلّل المقال التالي واكتب سكربت فيديو قصير رأسي (60 ثانية) للناشور بالعربية.

ملزم للشرط:
1. "hook": جملة افتتاحية قوية (0-3 ثانية) توقف التمرير — سؤال أو معلومة صادمة. حتى 120 حرفاً.
2. "scenes": من 3 إلى 8 مشاهد، كل مشهد جملة أو جملتان قصيرتان من السهولة بالسماع (حتى 280 حرفاً)، تُقرأ بترتيب.
3. آخر مشهد دعوة لاتخاذ إجراء (CTA) واضحة.
4. بدون علامات ترقيم زائدة، وبدون تعليمات أو علامات غنية (مثل ## أو **).
5. أعد JSON فقط — بدون أي نص خارج كائن JSON، بصيغة:
{"hook": "...", "scenes": ["...", "..."]}

المقال:
"""
${text}
"""`;
  }
  return `Analyze the article below and write a 60-second vertical short-video narration script in English.

Strict rules:
1. "hook": a scroll-stopping opener (0-3s), max 120 chars.
2. "scenes": 3-8 scenes, each 1-2 short spoken sentences (max 280 chars), in order.
3. The last scene is a clear call-to-action.
4. Plain spoken language, no markdown or extra punctuation noise.
5. Reply with JSON only — no text outside the JSON object:
{"hook": "...", "scenes": ["...", "..."]}

Article:
"""
${text}
"""`;
}

/** يفرّغ JSON من أي مغلفين نصائيين شائعين حوله. */
function parseJSONLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("رد الذكاء الاصطناعي لا يحتوي كائن JSON.");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

/**
 * نص/موضوع أو رابط — يجلب المقال عند وجود رابط، ثم يُولّد السكربت.
 * النموذج: Gemini REST — يُلمس الشبكة حينها فقط (في الاختبارات فُرّض fetch).
 */
export async function generateScript(
  input: { url?: string; topic?: string; lang: "ar" | "en" },
  fetchImpl: FetchLike = fetch,
): Promise<{ hook: string; scenes: Array<{ id: string; text: string }> }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY غير مُهيأ. أضف مفتاح Google AI Studio إلى متغيرات البيئة (خادم فقط — لا يظهر للعميل).",
    );
  }
  if (!input.topic && !input.url) {
    throw new Error("مطلوب رابط مقال أو موضوع.");
  }

  let sourceText: string;
  if (input.url) {
    const page = await fetchImpl(input.url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; my-video-bot/0.1)" },
    });
    if (!page.ok) {
      throw new Error(`فشل جلب المقال (${page.status}).`);
    }
    sourceText = extractArticleText(await page.text());
  } else {
    sourceText = input.topic!;
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const response = await fetchImpl(
    `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(sourceText, input.lang) }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // نص رد المزوّد يُسجَّل في الخادم فقط — قد يحمل تفاصيل داخلية لا تخصّ العميل
    console.warn("script-generator: رد Gemini غير ناجح", response.status, detail.slice(0, 300));
    throw new Error(`فشل استدعاء Gemini (${response.status}).`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    throw new Error("رد Gemini فارغ أو غير مفهوم.");
  }

  const parsed = ScriptResponse.parse(parseJSONLoose(raw));
  // أخزن الحد الأقصى 12 مشهدًا (ShortProps) وقصّ مفرط السرعة مع الصوت بأي حال
  const scenes = parsed.scenes.map((text, i) => ({
    id: `s${i + 1}`,
    text: text.trim(),
  }));
  if (scenes.length === 0 || scenes.every((s) => !s.text)) {
    throw new Error("الرد النموذجي خالٍ من المشاهد.");
  }
  return { hook: parsed.hook.trim(), scenes };
}
