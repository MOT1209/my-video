---
name: url-groq-video-generator
description: يحول رابط ويب إلى سكربت فيديو عمودي (hook + حتى 12 مشهداً) مع تعليق صوتي عربي عبر Groq — مجاناً
version: 1.0.0
---

# URL → Groq Video Generator

حين يعطيك المستخدم **رابط ويب** ويريد تحويله إلى فيديو عمودي (Shorts/Reels/TikTok)، نفّذ خط الأنابيب التالي باستخدام الكود في هذا المجلد. كل شيء مجاني عبر مفتاح Groq واحد (`GROQ_API_KEY`).

## خط الأنابيب (3 مراحل)

### 1. كشط الرابط (`scrape.ts`)

```ts
import { scrapeUrl } from "./index";
const article = await scrapeUrl("https://example.com/article");
```

- يستخدم `cheerio` (مجاني، بدون API).
- يرجع `{ url, title, description, text }` بعد تنظيف السكربتات والتنقلات.
- يقبل فقط روابط `http(s)` ويرفض غيرها.

### 2. التلخيص إلى JSON (`summarize.ts`)

```ts
import { summarizeWithGroq } from "./index";
const summary = await summarizeWithGroq(article, { maxScenes: 8 });
```

- النموذج: `llama3-8b-8192` على `https://api.groq.com/openai/v1/chat/completions`.
- يطلب `response_format: { type: "json_object" }` ثم يتحقق بـ zod.
- المخرجات مطابقة لـ `types/shorts.ts`:
  - `hook`: سطر واحد ≤ 120 حرفاً.
  - `scenes`: من 1 إلى 12 مشهداً، كل `text` ≤ 280 حرفاً، `id` بصيغة `s1, s2, ...`.

### 3. التعليق الصوتي العربي (`groq-tts.ts`)

```ts
import { synthesizeScenesAudio } from "./index";
const audio = await synthesizeScenesAudio(summary.scenes, { voice: "noura" });
```

- الـ endpoint: `POST https://api.groq.com/openai/v1/audio/speech`
- النموذج: `canopylabs/orpheus-arabic-saudi` — الأصوات: `fahad` (مذكر)، `noura` (مؤنث، الافتراضي).
- **القيد: 200 حرف كحد أقصى لكل طلب** — الدالة `chunkTextForTts()` تقسّم كل مشهد على حدود الجمل العربية (`؟ ! . …` + السطور) بتعبئة جشعة، وتقسيم الكلمات عند الضرورة. كل قطعة ≤ 200 حرف مضمون.
- كل مشهد يُحفظ كملف WAV مستقل **متزامن مع المشهد** في التخزين المؤقت:
  `<tmp>/groq-shorts/<hash>/s1.wav, s2.wav, ...` + `manifest.json` + (اختياري) `combined.wav` مدمج عبر `concatWav()`.
- `concatWav()` يتحقق من تطابق تنسيق الـ WAV (القنوات/معدل العينات/البت) قبل الدمج ويرفض الملفات غير المتوافقة برسالة واضحة.

## الدالة الجامعة (`index.ts`)

```ts
import { generateShortFromUrl } from "./index";

const { summary, narrationText, audio } = await generateShortFromUrl(url, {
  voice: "noura",      // أو "fahad"
  maxScenes: 8,        // ≤ 12
  combineAudio: true,   // إنتاج combined.wav
});
// summary → يتوافق مع ShortProps (hook + scenes) مباشرة
// narrationText → مبني بـ buildNarrationText من types/shorts.ts
// audio.scenes[i].filePath → ملف WAV الخاص بالمشهد i
```

## المتطلبات

- `GROQ_API_KEY` في البيئة (`.env.local` — لا تلتزم به في git أبداً).
- الاعتماد `cheerio` (مثبت في `package.json`).

## ملاحظات للوكيل

- إن فشل طلب صوتي (429/5xx) تُعاد المحاولة 3 مرات بتراجع أسّي — لا تقسّم يدوياً، الكود يتكفل.
- Groq TTS لا يرجع حدود كلمات — للكابشن استخدم `distributeCaptionsEvenly(narrationText, durationSec)` من `types/shorts.ts`.
- لا تتجاوز 12 مشهداً أبداً (`ShortProps` يرفض أكثر).
