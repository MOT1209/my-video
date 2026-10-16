---
name: ai-voice-tts
description: معيار توليد الصوت العربي/الإنجليزي — Edge-TTS الافتراضي + Groq المجاني + Fish Drama 3 التمثيلي، مع كاش وتوقيت كلمات
version: 1.0.0
---

# AI Voice & TTS Engineering

يوحّد هذا الـ skill مزودي الصوت الثلاثة في المستودع ويمنع تكرار التنفيذ. لا تنشئ عميل TTS جديداً دون سبب موثق.

## هرمية المزودين (ملزمة)

| الأولوية | المزود | الملف | متى |
|---|---|---|---|
| 1 (افتراضي المنتج) | Edge-TTS غير الرسمي + `WordBoundary` | `src/lib/edge-tts.ts` + `src/lib/tts.ts` | كل تعليق محايد سريع/رخيص، وهو الوحيد الذي يرجع توقيت كلمات حقيقياً |
| 2 (سكربت URL مجاني) | Groq `canopylabs/orpheus-arabic-saudi` | `.agents/skills/url-groq-video-generator/groq-tts.ts` | خط أنابيب URL→فيديو فقط؛ بلا حدود كلمات |
| 3 (تمثيلي مدفوع) | Fish Audio Drama 3 | `.agents/skills/fish-drama3-tts/` | أداء موجَّه ([sigh]/همس/حوار) فقط — يستهلك رصيداً وهو Preview |

التفاصيل الكاملة لكل مزود في skill الخاص به (`fish-drama3-tts/SKILL.md`، `url-groq-video-generator/SKILL.md`). هذا الملف هو **الموجّه** لا البديل.

## متى يُفعَّل

- أي عمل على `/api/tts`، `synthesizeNarration`، التخزين المؤقت للصوت، توقيت الكلمات، أصوات جديدة، fallback بين المزودين.
- **لا تفعّله** لعرض الكابشن (استخدم `kinetic-captions`) أو الخلفيات (`cinematic-media`).

## ملفات يجب فحصها أولاً

- `src/lib/tts.ts` — `MAX_TTS_CHARS=1000`، `hashNarration(voiceId::text)`، `synthesizeNarration` (3 محاولات)، `getCachedAudio`/`putAudioCache` (Blob ثم `public/audio`).
- `src/lib/edge-tts.ts` — WebSocket + `Sec-MS-GEC v2`، `wordBoundaryEnabled:true`، مهلة 60 ثانية.
- `src/app/api/tts/route.ts` — حد 20 طلب/5 دقائق لكل IP، تحقق zod (`text ≤1200`، `voiceId` افتراضي `DEFAULT_AR_VOICE`).
- `types/shorts.ts` — `AR_VOICES` (زارية/حامد)، `EN_VOICES` (Ava/Andrew)، `distributeCaptionsEvenly` كملاذ، `SHORT_MAX_SECONDS=60`.
- `.env.example` — المفاتيح الثلاثة (`BLOB_READ_WRITE_TOKEN`، `GROQ_API_KEY`، `FISH_AUDIO_API_KEY`).

## المدخلات والمخرجات

- **مدخلات**: `text` (بعد `trim`، ≤1000 حرف لمسار Edge)، `voiceId` (معرف Edge الكامل أو `noura`/`fahad` لمسار Groq أو `reference_id` لمسار Fish).
- **مخرجات**: `{audio: Buffer, captions: WordCaption[], durationSec, hash}` — المدة مسقوفة بـ 60 ثانية والكابشن مُرشَّح لما قبل السقف.
- **قاعدة التوقيت**: Edge يرجع `WordBoundary` حقيقياً؛ Groq/Fish بلا حدود → `distributeCaptionsEvenly(narrationText, durationSec)` من ملف الصوت الفعلي، لا من تقدير.

## سير العمل

1. حدد المسار من طلب المستخدم: محايد → Edge، رابط ويب → Groq skill، تمثيلي → Fish skill. لا تخلط المسارات في نفس المشهد.
2. تحقق من `MAX_TTS_CHARS` **قبل** أي اتصال شبكة، واقطع النص على حدود الجمل العربية (`؟ ! . …`) لا وسط الكلمة.
3. استخدم مفتاح الكاش `sha256(voiceId::text)` مقتطعاً 32 حرفاً (`shorts-audio/<hash>.mp3` + `.json` sidecar). نفس النص + نفس الصوت = نفس الملف؛ أي اختلاف (صوت/نص/توجيه) = hash مختلف.
4. الأخطاء المؤقتة (429/5xx/شبكة): 3 محاولات بتراجع أسّي (`attempt * 2000ms`). لا تعيد 401 (مفتاح) و402 (رصيد): اعرض رسالة إصلاح واضحة.
5. عند غياب `captions` من المزود: قدّر المدة من حجم الملف (`audio.length/6000` مسقوفاً بـ 60) ووزّع بالتساوي — ووثّق أن التوقيت تقديري في تلك الحالة.

## المعايير

- المفاتيح **خادم فقط** (`process.env` في route/skills). ممنوع وصول `NEXT_PUBLIC_*` لأي مفتاح صوت.
- `escapeSsml` للنص قبل حقنه في SSML (موجود في `edge-tts.ts`) — أي مسار جديد يبني SSML يجب أن يهرب `&<>"'`.
- `allowOverwrite: true` لوضعيات Blob مزدوجة (الصوت + sidecar) — راجع إصلاح `c7dc0dd` قبل تغيير منطق الرفع.
- حدّد `timeoutMs` صريحاً لكل مزود (Edge: 60s، Groq: 60s) مع `AbortController` حيث أمكن.

## الأمان

- لا تسجّل النص الكامل مع المفتاح في نفس السطر أبداً؛ لا تعرض المفاتيح في رسائل الخطأ للعميل.
- رسائل العميل عامة ومترجمة (`friendlyRenderError` نمطاً)؛ التفاصيل التقنية للسجلات فقط.
- تحقق من حجم الصوت قبل التخزين (ارفض ملفاً فارغاً `empty-audio` وملفاً شاذ الحجم يستحق تحقيقاً).

## معالجة الأخطاء

| الحالة | السلوك |
|---|---|
| نص فارغ | خطأ عربي صريح قبل أي شبكة |
| نص >1000 حرف (Edge) | رفض قبل الطلب مع ذكر الطول والحد |
| Edge 403 متكرر | رسالة شبكة/حظر مؤقت + إعادة بعد دقيقة (لا تكشف التوكن) |
| Blob خاص (private) | رسالة إصلاح public-access (نمط `BlobAccessError`) |
| Groq قطعة >200 حرف | `chunkTextForTts` يقسّم تلقائياً — لا تقسّم يدوياً |
| Fish نفاد رصيد (402) | لا إعادة — اعرض شحن الرصيد |

## الاختبار

- `bun test`: غطِّ `hashNarration` (نفس المدخل=نفس الهاش، صوت مختلف=هاش مختلف)، رفض الطول، `clampSummary`-إن لزم، تقسيم Groq على 200 حرف، `concatWav` برفض غير المتوافق.
- اختبارات الشبكة الحقيقية **معزولة** خلف متغير بيئة ولا تعمل في CI افتراضياً. لا تعتمد على API مدفوع في اختبار الوحدة.
- لا تدّعِ نجاح اختبار دون تشغيل `bun test` فعلياً.

## معايير القبول

- لا يوجد عميل TTS رابع دون مبرر مكتوب في PR.
- المفاتيح لا تظهر في العميل أو السجلات أو التقارير.
- الكاش لا يعيد صوتاً خاطئاً لمدخل مختلف (اختبار تضارب الهاش موجود).
- العربي والإنجليزي يعملان بالأصوات الأربعة الموثقة في `types/shorts.ts`.

## القيود

- Edge-TTS **غير رسمي** (توكن `Sec-Ms-Gec` قابل للكسر) — أي تغيير فيه يجب أن يرافقه تقييم fallback رسمي (Azure Speech) كخطة، لا كتنفيذ صامت.
- Fish Drama 3 في Preview: النتائج متفاوتة — ولّد 2–3 محاولات للمقاطع الحساسة واختر الأفضل.
- ممنوع رفع حد 1000 حرف دون تحليل أثر 60 ثانية وسقف `captions ≤600`.
