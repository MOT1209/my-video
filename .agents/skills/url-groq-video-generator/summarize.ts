import {
  GROQ_CHAT_URL,
  GROQ_SUMMARY_MODEL,
  GroqSummarySchema,
  requireGroqKey,
  type GroqSummary,
} from "./types";
import type { ScrapedArticle } from "./scrape";

export interface SummarizeOptions {
  apiKey?: string;
  model?: string;
  /** عدد المشاهد المطلوب (1..12) — الافتراضي 8 */
  maxScenes?: number;
  temperature?: number;
  timeoutMs?: number;
}

const HOOK_MAX = 120;
const SCENE_MAX = 280;
const SCENES_HARD_MAX = 12;

function coerceScenesCount(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) {
    return 8;
  }
  return Math.min(SCENES_HARD_MAX, Math.max(1, Math.round(n)));
}

function buildSystemPrompt(maxScenes: number): string {
  return (
    "أنت كاتب سكربتات فيديو عمودية (Shorts/Reels/TikTok) باللغة العربية. " +
    "أجب بصيغة JSON فقط بدون أي شرح خارجها، وبالشكل التالي تماماً:\n" +
    '{"hook": "سطر خطّاف", "scenes": [{"id": "s1", "text": "نص المشهد"}]}\n' +
    `الشروط الصارمة:\n` +
    `- hook: جملة واحدة مشوّقة لا تتجاوز ${HOOK_MAX} حرفاً.\n` +
    `- scenes: من 1 إلى ${maxScenes} مشاهد (لا تتجاوز ${SCENES_HARD_MAX} أبداً).\n` +
    `- كل مشهد: جملة أو جملتان بحد أقصى ${SCENE_MAX} حرفاً، متسلسلة منطقياً ومصاغة للتعليق الصوتي.\n` +
    `- المعرفات: s1, s2, ... بالترتيب.\n` +
    "- اللغة: العربية الفصحى المبسطة ما لم يكن النص المدخل إنجليزياً."
  );
}

/**
 * تقليم دفاعي لأي ناتج خام ليطابق قيود ShortProps —
 * دالة خالصة (تُختبر بدون شبكة).
 */
export function clampSummary(raw: unknown, maxScenes = 8): GroqSummary {
  const fallbackHook = "الخلاصة التي تحتاج معرفتها";
  const count = coerceScenesCount(maxScenes);

  const obj =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const hook =
    typeof obj.hook === "string" && obj.hook.trim()
      ? obj.hook.trim().slice(0, HOOK_MAX)
      : fallbackHook;

  const rawScenes = Array.isArray(obj.scenes) ? obj.scenes : [];
  const scenes = rawScenes.slice(0, count).map((s, i) => {
    const rec =
      typeof s === "object" && s !== null ? (s as Record<string, unknown>) : {};
    const text =
      typeof rec.text === "string" && rec.text.trim()
        ? rec.text.trim().slice(0, SCENE_MAX)
        : "";
    return { id: `s${i + 1}`, text, imageUrl: null as string | null };
  });

  const parsed = GroqSummarySchema.safeParse({ hook, scenes });
  if (parsed.success) {
    return parsed.data;
  }
  // ملاذ أخير: مشهد واحد عام (لا نرمي خطأ — الفيديو يجب أن يُبنى دائماً)
  return GroqSummarySchema.parse({
    hook: hook.slice(0, HOOK_MAX),
    scenes: [{ id: "s1", text: fallbackHook, imageUrl: null }],
  });
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("رد Groq لا يحتوي JSON");
  }
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

/** تلخيص مقال مكشوط إلى {hook, scenes} عبر llama3-8b-8192 */
export async function summarizeWithGroq(
  article: ScrapedArticle,
  opts: SummarizeOptions = {},
): Promise<GroqSummary> {
  const {
    model = GROQ_SUMMARY_MODEL,
    temperature = 0.7,
    timeoutMs = 60000,
  } = opts;
  const apiKey = requireGroqKey(opts.apiKey);
  const maxScenes = coerceScenesCount(opts.maxScenes);

  const userContent =
    `العنوان: ${article.title}\n` +
    (article.description ? `الوصف: ${article.description}\n` : "") +
    `عدد المشاهد المطلوب: ${maxScenes}\n\nالنص:\n${article.text}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(maxScenes) },
          { role: "user", content: userContent },
        ],
        temperature,
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    throw new Error(
      `تعذر الاتصال بـ Groq (${(err as Error).name === "AbortError" ? "انتهت المهلة" : (err as Error).message})`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq chat فشل: HTTP ${res.status} — ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new Error("رد Groq فارغ");
  }
  return clampSummary(extractJson(content), maxScenes);
}
