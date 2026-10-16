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

## ضوابط الجودة (ملزمة لأي تعديل لاحق)

### 1. التحقق من المخرجات

- كل ناتج LLM يمر عبر `clampSummary(raw, maxScenes)` ثم `GroqSummarySchema.safeParse` — لا تقبل JSON خاماً مباشرة.
- `hook ≤120` وكل `text ≤280` و`scenes ≤12` و`id` بصيغة `s1..sN` بالترتيب. `clampSummary` يقصّ ويعيد الترقيم تلقائياً — لا تعيد كتابته يدوياً.
- الملفات المرجعية: `summarize.ts` (البرومبت + `clampSummary` + `extractJson`)، `types.ts` (`GroqSummarySchema`)، `types/shorts.ts` (`ShortProps` — العقد النهائي).

### 2. الفاكتوالية ونسب المصدر

- النموذج الحالي (`llama3-8b-8192`) قد **يخترع حقائق**. القاعدة: السكربت يعيد صياغة نص المقال المكشوط فقط — لا أرقام/تواريخ/أسماء جديدة ليست في `article.text`.
- عند الشك: قصّر المشهد إلى ما هو مؤكد في النص بدل حذفه. لا تضف مصادر وهمية أو روابط غير مكشوطة.
- أي مطالبة بدقة أعلى (اقتباسات حرفية) تتطلب وضع `temperature` منخفضاً وتمرير `article.url` كحقل نسب في الواجهة لاحقاً — لا تدّعِ التوثيق دون تنفيذ.

### 3. الروابط غير المدعومة تفشل بلطف

- `scrapeUrl` يقبل `http(s)` فقط ويرفض غيرها بخطأ صريح قبل أي استدعاء Groq (لا تكلفة على مدخل مرفوض).
- فشل الكشط (حظر/JS ثقيل/فارغ) → خطأ عربي واضح يقترح لصق النص يدوياً، لا إعادة محاولة لا نهائية ولا JSON مُختلق.
- لا تجلب عناوين داخلية (`localhost`، شبكات خاصة، `169.254.x`، metadata السحابة) — طالع `cinematic-media/SKILL.md` و`api-security-cost-protection/SKILL.md` لسياسة SSRF قبل توسيع الكشاط خارج هذه القائمة.

### 4. تقدير الطول والمدة

- قبل التوليد: قدّر `buildNarrationText({hook, scenes}).length` مقابل `MAX_TTS_CHARS=1000` في `src/lib/tts.ts`. تجاوز الحد = قصّ المشاهد (الأحدث أولاً) أو اطلب `maxScenes` أقل — لا ترسل طلباً سيفشل.
- القاعدة التقريبية: ~800–1000 حرف عربي ≈ 60 ثانية صوتاً. سكربت من 8 مشاهد × ~150 حرفاً ≈ الحد الأقصى. وثّق أي تجاوز في وصف التغيير.

### 5. الاختبار

- `summarize.test.ts` يغطي `clampSummary` دون شبكة (قصّ hook/مشاهد، إعادة ترقيم، ملاذ المشهد الواحد) — أي تغيير في القيود يجب أن يحدّث هذه الاختبارات أولاً.
- اختبارات الشبكة (كشط/تلخيص حقيقي) معزولة ولا تعمل في CI. لا تدّعِ نجاح اختبار دون `bun test` فعلي.

## القيود والممنوعات

- ممنوع تكرار تكامل Groq/TTS خارج هذا المجلد — المسار الموحد عبر `index.ts` (`generateShortFromUrl`) و`ai-voice-tts/SKILL.md` للتوجيه بين المزودين.
- ممنوع رفع `maxScenes` فوق 12 أو `SCENE_MAX` فوق 280 دون تحديث `ShortScene` و`ShortProps` واختباراتهما (`types/shorts.test.ts`).
- ممنوع تخزين `GROQ_API_KEY` في أي ملف ملتزَم — `.env.local` فقط (راجع `.env.example`).
