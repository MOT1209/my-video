import { load } from "cheerio";

/** سقف أحرف النص المرسل لنموذج التلخيص (llama3-8b-8192 سياقه 8192 توكن) */
export const MAX_SCRAPE_CHARS = 12000;

export interface ScrapedArticle {
  url: string;
  title: string;
  description: string;
  text: string;
  charCount: number;
}

export interface ScrapeOptions {
  timeoutMs?: number;
  maxChars?: number;
}

function assertHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`رابط غير صالح: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`يُقبل فقط http/https — وصل: ${parsed.protocol}`);
  }
  return parsed;
}

function collapseWhitespace(s: string): string {
  return s.replace(/[ \t\u00a0]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * استخراج النص المقروء من HTML — دالة خالصة (قابلة للاختبار بدون شبكة).
 * يفضّل <article>/<main> ثم يلتقط العناوين والفقرات والقوائم بترتيبها.
 */
export function extractArticleText(html: string): {
  title: string;
  description: string;
  text: string;
} {
  const $ = load(html);

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    $("h1").first().text().trim();

  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    "";

  // إزالة كل ما ليس محتوى مقروءاً
  $(
    "script, style, noscript, iframe, svg, canvas, form, button, nav, footer, aside, [hidden]",
  ).remove();

  const root = $("article").first().length
    ? $("article").first()
    : $("main").first().length
      ? $("main").first()
      : $("[role='main']").first().length
        ? $("[role='main']").first()
        : $("body");

  const parts: string[] = [];
  root.find("h1, h2, h3, h4, p, li, blockquote, figcaption").each((_, el) => {
    const t = collapseWhitespace($(el).text());
    // تجاهل الفتات القصيرة (روابط تنقل/أزرار) والفقرات الطويلة جداً المشبوهة
    if (t.length >= 20 && t.length <= 3000) {
      parts.push(t);
    }
  });

  let text = collapseWhitespace(parts.join("\n\n"));
  if (!text) {
    // ملاذ أخير: كل نص الصفحة
    text = collapseWhitespace(root.text()).slice(0, MAX_SCRAPE_CHARS);
  }

  return { title, description, text };
}

/** كشط رابط ويب مجاناً عبر fetch + cheerio */
export async function scrapeUrl(
  url: string,
  opts: ScrapeOptions = {},
): Promise<ScrapedArticle> {
  const { timeoutMs = 15000, maxChars = MAX_SCRAPE_CHARS } = opts;
  const parsed = assertHttpUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "ar,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    throw new Error(
      `تعذر جلب الرابط (${(err as Error).name === "AbortError" ? "انتهت المهلة" : (err as Error).message})`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`فشل الجلب: HTTP ${res.status} للرابط ${parsed.toString()}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(contentType)) {
    throw new Error(`نوع المحتوى غير مدعوم (${contentType}) — نحتاج صفحة HTML`);
  }

  const html = await res.text();
  const { title, description, text } = extractArticleText(html);
  const sliced = text.slice(0, maxChars).trim();
  if (!sliced) {
    throw new Error("لم يُستخرج أي نص مقروء من الصفحة");
  }
  return {
    url: parsed.toString(),
    title,
    description,
    text: sliced,
    charCount: sliced.length,
  };
}
