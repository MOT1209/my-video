import { createHash } from "node:crypto";
import type { WordCaption } from "../../types/shorts";

/**
 * Azure Speech الرسمي — fallback لنقطة ضعف Edge-TTS غير الرسمية
 * (توكن `Sec-Ms-Gec` قد ينكسر بأي وقت — الخطر رقم 1 في الخطة).
 *
 * التفعيل اختياري: يُستخدم فقط عند توفّر AZURE_SPEECH_KEY + AZURE_SPEECH_REGION
 * — دونها يبقى Edge-TTS المجاني هو الوحيد (سلوك سابق دون تغيير).
 *
 * ملاحظة تصميم: لا يعيد Azure tokens بكلمات في هذا الإصدار — نُقدّر
 * المدة بطول الصوت ونُوزع الكلمات انتظامياً (نفس Fallback الحالي
 * للكابشن في tts.ts). إعداد كامل للكابشن الدقيق عبر SSML يستحق جولة لاحقة.
 */

const AZURE_TTS_HOST = (region: string) => `${region}.tts.speech.microsoft.com`;
const AZURE_TOKEN_HOST = (region: string) => `${region}.api.cognitive.microsoft.com`;

export interface AzureSynthesis {
  audio: Buffer;
  captions: WordCaption[];
  durationSec: number;
}

/** escape SSML الأساسي (نفس تعليمة Edge-TTS) */
function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** يرجع null إن لم تكن مُهيأة المفاتيح. */
export async function azureToken(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    return null;
  }
  const res = await fetchImpl(`https://${AZURE_TOKEN_HOST(region)}/sts/v1.0/issueToken`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key },
  });
  if (!res.ok) {
    throw new Error(`فشل الحصول على توكن Azure Speech (${res.status}).`);
  }
  return res.text();
}

/** أسماء أصوات Azure تنتهي بـ Neural (نفس أسماء Edge المستعملة عندنا). */
export function isAzureVoice(voiceId: string): boolean {
  return /Neural$/.test(voiceId);
}

/**
 * توليد mp3 عبر REST الرسمي — يُلمس الشبكة فقط عند المفاتيح المهيأة.
 * يعمل مع أي voiceId متوافق مع Azure (نفس الأسماء المستخدمة في Edge-TTS).
 */
export async function synthesizeAzure(
  text: string,
  voiceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AzureSynthesis> {
  const token = await azureToken(fetchImpl);
  if (!token) {
    throw new Error(
      "Azure Speech مُفتاحان غير مُهيأين (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION).",
    );
  }
  const region = process.env.AZURE_SPEECH_REGION!;
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voiceId.slice(0, 5)}'>
    <voice name='${voiceId}'>${escapeSsml(text)}</voice>
  </speak>`;

  const res = await fetchImpl(`https://${AZURE_TTS_HOST(region)}/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "my-video-app",
    },
    body: ssml,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `فشل Azure TTS (${res.status}) ${detail.slice(0, 200)}`,
    );
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.length === 0) {
    throw new Error("Azure TTS أعاد صوتاً فارغاً.");
  }

  // تقدير المدة من الحجم بخط bitrate الثابت 48kbps — دقيق بما يكفي للتوقيت
  const durationSec = audio.length / (48_000 / 8);
  const words = text.split(/\s+/).filter(Boolean);
  const per = words.length > 0 ? durationSec / words.length : 0;
  const captions: WordCaption[] = words.map((word, i) => ({
    word,
    start: Number((i * per).toFixed(3)),
    end: Number(((i + 1) * per).toFixed(3)),
  }));

  return { audio, captions, durationSec };
}

/** هاش مزج للكاش — مُختلف عن edge-tts لنفس ال voiceId (بديل في الغالب). */
export function azureNarrationHash(text: string, voiceId: string): string {
  return createHash("sha256")
    .update(`azure::${voiceId}::${text}`)
    .digest("hex")
    .slice(0, 32);
}

/** هل المفتاحان مهيأتان؟ — للاستخدام الخارجي. */
export function isAzureConfigured(): boolean {
  return Boolean(
    process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION,
  );
}
