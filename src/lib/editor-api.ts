import type { WordCaption } from "../../types/shorts";

/**
 * استدعاءات الواجهة لمسارات الـ API (عميل فقط). مفصولة عن المكوّن كي تُختبر
 * بلا DOM: كل دالة ترمي `Error` برسالة الخادم العربية عند الفشل.
 */

type ApiEnvelope<T> = { type: "success"; data: T } | { type: "error"; message: string };

async function postJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: ApiEnvelope<T>;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(fallbackError);
  }
  if (json.type !== "success") {
    throw new Error(json.message || fallbackError);
  }
  return json.data;
}

export function requestScript(args: {
  source: string;
  isUrl: boolean;
  lang: "ar" | "en";
}): Promise<{ hook: string; scenes: Array<{ text: string }> }> {
  return postJson(
    "/api/script",
    { ...(args.isUrl ? { url: args.source } : { topic: args.source }), lang: args.lang },
    "فشل توليد السكربت",
  );
}

export function requestBackground(prompt: string): Promise<{ url: string; cached: boolean }> {
  return postJson("/api/image", { prompt }, "فشل توليد الخلفية");
}

export function requestNarration(args: {
  text: string;
  voiceId: string;
}): Promise<{
  audioUrl: string;
  captions: WordCaption[];
  durationSec: number;
  cached: boolean;
}> {
  return postJson("/api/tts", args, "فشل توليد الصوت");
}
