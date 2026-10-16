# خارطة الطريق التنفيذية — my-video

> تاريخ التحديث: 2026-10-16
> الحالة: المراحل 1–3 منجزة؛ المرحلة 4 (SaaS) قيد التنفيذ

---

## أولاً: الموقف الحالي

| المحور | الحالة |
|---|---|
| التصيير | Remotion 4.0.535 + Vercel Sandbox مع **snapshot cache** وكاش ناتج حتمي (`src/lib/render-cache.ts`) وقياس $/video (`src/lib/render-metrics.ts`) و SSE للتقدم |
| TTS | Edge-TTS + كاش بالـ hash + **WordBoundary events** تنتج `WordCaption[]` بالتوقيت (`src/lib/edge-tts.ts:129`) + **fallback رسمي** عبر Azure Speech (`src/lib/azure-tts.ts`) |
| الكابشن | ✅ متحرك (4 أنماط: pop/karaoke/slide-up/glow عبر `spring` + `createTikTokStyleCaptions`) |
| الخلفيات | 5 ثيمات CSS + Ken Burns للصور/الفيديو + **صور AI** عبر `/api/image` (Gemini + كاش content-hash) |
| الذكاء الاصطناعي | ✅ `/api/script` (رابط/موضوع → سكربت عبر Gemini) + `/api/image` (خلفيات) + Azure fallback |
| SaaS | شريحة localStorage + SaaS خادم منجز (Drizzle + billing/credits/projects/renders/transcribe + sign-in) |
| الاختبارات | `bun test` (**90 اختباراً** عبر 15 ملفاً) |
| حدود المعدل | `/api/tts` = 20/5 دقائق، `/api/render` = 5/ساعة — عبر **Upstash Redis** (موزّع) مع fallback للذاكرة محلياً |

---

## ثانياً: جدول الفجوات مقابل المشاريع الخمسة

| الميزة | my-video | short-video-maker | TikTok-Forge | AiShorts… | Video-Gen-AI | vanta |
|---|---|---|---|---|---|---|
| كابشن متحرك بـ spring | ❌ | — | ✅ | ✅ | ✅ | ✅ WhisperX |
| خلفيات AI | ❌ | ✅ Gemini | ✅ | ✅ SD3.5 | ✅ HuggingFace | ✅ |
| خلفيات فيديو/حركة | ❌ | ✅ Pexels | ✅ | ❌ | ❌ | ✅ |
| تلخيص مقال → سكربت | ❌ | ✅ | ✅ Gemini | ✅ | ✅ GPT-4o | ✅ |
| مصادقة مستخدمين | ❌ | ❌ | ✅ | ✅ | ✅ Clerk | ✅ |
| قاعدة بيانات | ❌ | ✅ SQLite | ✅ NocoDB | ✅ Postgres | ✅ Neon/Drizzle | ✅ |
| اشتراكات | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| بنية تصيير | Sandbox | MoviePy | Remotion | **AWS Lambda** | Remotion | Remotion |
| طابور/مهام | ❌ | ❌ | ✅ n8n | ✅ | ❌ | ✅ |

**المستودعات المرجعية:**

| المشروع | المستودع |
|---|---|
| short-video-maker | `gyoridavid/short-video-maker` + `aaurelions/short-video-maker` |
| TikTok-Forge | `ezedinff/TikTok-Forge` |
| AiShortsVideosGenerator | `RianNegreiros/AiShortsVideosGenerator` |
| Video-Generator-AI | `ARYPROGRAMMER/Video-Generator-AI` |
| vanta | `itsjwill/vanta` |

### أهم 4 استنتاجات

1. الكابشن المتحرك هو **الفجوة الأكبر والأقل كلفة حلاً** — كل المنافسين يمتلكونه.
2. لا أحد يجمع **BaaS موحّد** (Supabase) — كلٌّ يبني بطريقته، الفرصتك في الاختيار الأقل تعقيداً.
3. **لا أحد يبيع اشتراكات** — نقطة تميّز محتملة.
4. AiShorts وحده هاجر إلى Lambda؛ بقية المنافسين على Remotion مُدارة/مُستضافة.

---

## المراحل

### المرحلة 1 — الكابشن المتحرك + الخلفيات *(الأولوية، 1–2 أسبوع)*

#### 1.1 الكابشن المتحرك (الأثر الأكبر)

**المشكلة:** `src/remotion/Shorts/WordCaptions.tsx:52` يزحزح نافذة `WINDOW_SIZE=8` يدوياً، والكلمة النشطة تتبدّل بين `52px` و `58px` فورياً — لا `spring` ولا `interpolate`.

**الحل:**

```
تثبيت: @remotion/captions@4.0.535 + @remotion/layout-utils@4.0.535
```

| خطوة | التفصيل |
|---|---|
| تكييف النوع | `WordCaption {text,start,end}` → `Caption {text,startMs,endMs}` (متطابقان شكلياً — تحويل بسيط) |
| تقسيم الصفحات | استبدال النافذة اليدوية بـ `createTikTokStyleCaptions({combineTokensWithinMilliseconds})` — `800` لكلمة-بعضها أو `1200` لصف كامل |
| التوقيت | توليد `<Sequence from={page.startMs} durationInFrames={…}>` لكل صفحة بدلاً من الحساب اليدوي |
| حركة الدخول | `spring({config:{damping:200}, durationInFrames: min(4, tokenFrames/2)})` مع `transformOrigin:'center bottom'` |
| حركة الخروج | `interpolate` يُسقط التكبير في آخر 4 إطارات (يمنع القطع المفاجئ) |
| مقاس الكلمة | `fitText()` من `@remotion/layout-utils` — يمنع فوضى التفاف السطر في 9:16 |
| التباين | `WebkitTextStroke` + `paintOrder:'stroke fill'` بعرض `fontSize/7` |
| **RTL** | كل صفحة تُلفّ في حاوية `direction:rtl` مع `white-space:pre` |

**أنماط حركة قابلة للتبديل من المحرر** (تقليد vanta):

- `pop` — الافتراضي (تكبير مع نعومة)
- `karaoke` — تدرّج لون يعبر الكلمة (`background-clip:text` متحرك)
- `slide-up` — الكلمة تصعد مع شفافية
- `scale-glow` — تكبير + توهج accent

#### 1.2 الخلفيات

| إضافة | التنفيذ | الميزة |
|---|---|---|
| خلفية صورة متحركة | `Img` + `interpolate(frame,…)` تكبير 1.0→1.08 (Ken Burns) | حركة فورية بدون تكلفة AI |
| خلفية فيديو | `OffthreadVideo` بـ `objectFit:cover` + طبقة تعتيم `rgba(0,0,0,.45)` | بكرات Pexels/Unsplash مجانية |
| طبقة حبيبات | SVG `feTurbulence` بشفافية 0.04 | مظهر سينمائي |
| تدرّج متحرك | إزاحة `radial-gradient` بـ `spring` كل ثانية | انتقال بين الثيمات |
| **توليد AI** | (المرحلة 2) | خلفية فريدة لكل مشهد |

**قاعدة ثابتة:** أي خلفية جديدة تمرّ عبر `ShortPalette` القائم (`src/remotion/Shorts/Background.tsx:94`) حتى لا ينكسر تباين النص في 5 الثيمات الحالية.

---

### المرحلة 2 — تكاملات الذكاء الاصطناعي *(1–2 أسبوع)*

| القدرة | التنفيذ المقترح | التكلفة التقريبية |
|---|---|---|
| **توليد صور الخلفيات** | `@fal-ai/client` (FLUX/schnell) أو Gemini image — استجابة واحدة لكل مشهد | ~$0.003–0.01/صورة |
| **رابط/مقال → سكربت** | `fetch` + LLM (Gemini Flash / GPT-4o-mini) → هيكل `HOOK(0–3s) → BODY → CTA` متوافق مع `ShortScene` الحالي | ~$0.0002/طلب |
| **توليد الصور النصية** | نفس الـ LLM يكتب `{hook, bodyLines, cta}` مباشرة | مشمول |
| **ASR اختياري** | AssemblyAI/Whisper لملفات صوتية مرفوعة (يحل مشكلة حد 1000 حرف) | ~$0.001/دقيقة |

**هيكل API الجديد:**

```
POST /api/script    → { url|topic }    → { scenes: ShortScene[] }
POST /api/image     → { prompt,theme } → { blobUrl }
```

- المفاتيح **سرّية على الخادم فقط** (`process.env`) — لا تدخل حزمة العميل.
- كاش للصور بالـ content-hash (نفس النص + ثيم = نفس Blob) — يمنع تكلفة تكرارية.

**نقطة الضعف الوحيدة الحالية:** TTS يعتمد على Edge-TTS غير الرسمي (توكن `Sec-Ms-Gec`) — أضف fallback إلى Azure Speech official لتفادي الانقطاع.

---

### المرحلة 3 — بنية التصيير وخفض التكلفة *(1 أسبوع + قياس)*

> القرار: **البقاء على Vercel Sandbox.** snapshot cache موجود بالفعل — وهذا هو مكسب التكلفة الأول بالأصل.

| # | التحسين | الجهد | الأثر المتوقع |
|---|---|---|---|
| 1 | **كاش ناتج التصيير**: مفتاح `sha256(compositionId + inputProps)` → Blob URL. نفس الفيديو = صفر تكلفة | منخفض | عالٍ جداً |
| 2 | **عدم إيقاف الـ Sandbox بين مشاهد المشروع**: دمج مشاهد `scenes[]` في جلسة واحدة بدل `stop()` بعد كل مشهد (`route.ts:147`) | متوسط | عالٍ |
| 3 | **طابور تصيير**: طبقة DB + Vercel Cron تُسلسل العمليات وتمنع sandbox متوازٍ | متوسط | عالٍ |
| 4 | **نقل rate-limit إلى Upstash Redis** (`@upstash/ratelimit`) — الحالي في الذاكرة ينهار عند تعدّد النسخ | منخفض | موثوقية |
| 5 | **قياس فعلي**: سجّل `sandboxSeconds`, `blobBytes`, `concurrency` لكل عملية → `$/video` حقيقي | منخفض | أساسي |
| 6 | ضبط `jpegQuality` + `--concurrency` حسب vCPU الـ sandbox | منخفض | 10–20% |

**الحد المُوصى به:** لو `$/video` فاق 0.05$ أو زمن التصيير فاق 90 ثانية، راجع القرار (Lambda يُقدَّر بـ ~$0.10 لفيديو 60 ثانية لكنه أسرع بكثير وقابل للتوسّع).

---

### المرحلة 4 — تحويل SaaS *(2–3 أسبوع)*

#### المكدس الموصى به (متوافق مع Vercel)

| الطبقة | الاختيار | السبب |
|---|---|---|
| **مصادقة** | **Clerk** | جاهزة لـ Next.js 16، خطط مجانية، user/org/roles |
| **قاعدة بيانات** | **Neon Postgres + Drizzle ORM** | serverless، يتوقف للصفر، free tier |
| **تخزين** | Vercel Blob (موجود ✅) | مسار `renders/{userId}/{renderId}.mp4` لعزل المستخدمين |
| **فوترة** | **Stripe** بنظام **كريدت** (1 تصيير = 1 كريدت) | أسهل نموذج قياس استهلاك |
| **rate-limit** | Upstash Redis | يعمل عبر كل نسخ Vercel |
| **المهام** | Vercel Cron + جدول `renders` بحالة | يكفي للحجم الأولي |

#### نموذج البيانات المطلوب

```
User       (clerkId, plan, credits, createdAt)
Project    (id, userId, title, theme, scenesJson, updatedAt)
Render     (id, projectId, status, url, durationSec, sandboxMs, creditsUsed, error)
UsageEvent (id, userId, kind: tts|image|render, units, at)
```

#### ما ينقص المنتج حالياً (خارج الكود)

- حفظ/تحميل المشاريع (الآن حالة عميل فقط تُفقد عند تحديث الصفحة)
- سجل التصييرات + إعادة تنزيل
- قوالب جاهزة (hooks/CTA)
- لوحة استهلاك كريدت
- **فرض المصادقة** على `/api/render` (الآن أي شخص بـ IP مختلف يحصل على 5 تصييرات/ساعة مجاناً — ثغرة تكلفة مباشرة)

---

## الجدول الزمني

```
الأسبوع 1–2  ▸ المرحلة 1: كابشن متحرك + خلفيات متحركة   [أعلى أثر/أقل مجهود]
الأسبوع 3    ▸ المرحلة 3: كاش التصيير + قياس $/video     [يعتمد على 1]
الأسبوع 4–5  ▸ المرحلة 2: LLM + توليد صور + سكربت آلي
الأسبوع 6–8  ▸ المرحلة 4: Clerk + Neon + Stripe + حفظ المشاريع
```

**الترتيب مقصود:** المراحل 1 و 3 تُنجز **قبل** أي بنية SaaS، لأن إضافة مصادقة وقاعدة بيانات فوق نظام غير مُقاس وغير متحرك تُبطئ كل شيء لاحقاً.

---

## المخاطر

1. **Edge-TTS غير رسمي** — قد ينكسر بأي وقت؛ خطط لـ Azure Speech official كـ fallback.
2. ~~**rate-limit بالذاكرة** لا ينطبق على production (عدة نسخ خلفية)~~ — ✅ نُقل إلى Upstash Redis (المرحلة 3).
3. **بدون مصادقة**: مصروف sandbox مفتوح لأي زائر.
4. **حدود حالية**: 1000 حرف TTS، 60 ثانية، 5 تصييرات/ساعة/IP.

---

## سجل التقدّم

| التاريخ | المرحلة | الحالة |
|---|---|---|
| 2026-10-15 | إنشاء الخطة | ✅ |
| 2026-10-15 | المرحلة 1 — الكابشن المتحرك (spring + createTikTokStyleCaptions + fitText) | ✅ منجز |
| 2026-10-15 | المرحلة 1 — أنماط الحركة الأربعة (pop / karaoke / slide-up / glow) | ✅ منجز |
| 2026-10-15 | المرحلة 1 — الخلفيات: Ken Burns + فيديو + تعتيم + حبيبات | ✅ منجز |
| 2026-10-15 | المرحلة 1 — ربط المحرر بمنتقي أسلوب الكابشن | ✅ منجز |
| 2026-10-16 | المرحلة 3 — كاش ناتج التصيير (sha256 حتمي + head lookup) | ✅ منجز |
| 2026-10-16 | المرحلة 3 — قياس $/video (Active CPU + Memory + Network vs Vercel pricing) | ✅ منجز |
| 2026-10-16 | المرحلة 3 — جلسة sandbox واحدة لكل مستخدم (إعادة استخدام + خمول + retry واحد) | ✅ منجز |
| 2026-10-16 | المرحلة 3 — rate-limit إلى Upstash Redis (موزّع عبر كل النسخ + fallback محلي) | ✅ منجز |
| 2026-10-16 | المرحلة 3 — قفل تصيير موزّع لمنع sandboxes متوازية لكل مستخدم | ✅ منجز |
| 2026-10-16 | المرحلة 2 — ‏`/api/script`‏: رابط/موضوع → سكربت ‏ShortScene[] بـ Gemini (REST + JSON إجباري) | ✅ منجز |
| 2026-10-16 | المرحلة 2 — صور خلفيات AI ‏(`/api/image`) + كاش ‏Blob content-hash + زر في المحرّر | ✅ منجز |
| 2026-10-16 | المرحلة 2 — ‏fallback لـ Azure Speech الرسمي (يُلغي المخاطرة #1) | ✅ منجز |
| 2026-10-16 | المرحلة 3 — ضبط ‏`concurrency/jpegQuality` حسب vCPU (بند #6) | ✅ منجز |
| 2026-10-16 | المرحلة 4 — حفظ/تحميل حالة المحرّر محلياً (شريحة أولى من "حفظ المشاريع") | ✅ منجز |
| 2026-10-16 | المرحلة 4 — SaaS الخادم (Drizzle + billing/credits/projects/renders/transcribe + sign-in) | ✅ منجز (ملتزَم) |

### ملاحظات التنفيذ (المرحلة 4 — SaaS الخادم)

- الهوية (`src/lib/auth.ts`): مفاتيح Clerk موجودة → غير المسجّل يُرفض 401؛ بلا مفاتيح → مستخدم محلي (`local-dev-user`) بنفس سلوك ما قبل المرحلة 4. قرار مقصود وموثق — والنشر بلا مفاتيح يبقي `/api/render` مفتوحاً، لذا أُضيف `warnIfUnauthenticatedProduction()` (تحذير مرة واحدة في سجل الإنتاج).
- الكريدت (`src/lib/credits.ts` + `billing-session.ts`): تصيير = 1، ترحيب = 3، والحزم 10/$5 و30/$12 و100/$35 عبر `price_data` لحظياً (بلا Products يدوية). الخصم بعد تأكد غياب الكاش، والاسترجاع تلقائي عند الفشل. بلا `DATABASE_URL` → الكريدت غير مفروض + تحذير.
- قاعدة البيانات (`src/lib/db/` + `drizzle/0000_init.sql`): تُطبَّق بـ `npx drizzle-kit migrate` بعد ضبط `DATABASE_URL`. المسارات بلا قاعدة ترد 503 إرشادياً.
- الفوترة: الـ webhook يتحقق من التوقيع (`constructEventAsync`) ويرفض غيابه؛ الـ checkout يحتاج `STRIPE_SECRET_KEY`.
- الطابور (`/api/cron/retry-renders`): `CRON_SECRET` إلزامي (Bearer) وإلا 503 — يُضبط في Vercel Cron.
- بنود مفتوحة: سياسة الاحتفاظ/حذف البيانات، ومعايرة أسعار الحزم مقابل $/video المقاس فعلياً.

### ملاحظات التنفيذ (المرحلة 4 — شريحة حفظ المشاريع)

- `src/hooks/use-editor-state.ts`: نموذج بحفظ/تحميل الحالة إلى ‏`localStorage` (مفتاح `my-video:editor:v1`) — الخطاف + المشاهد + الثيم + أسلوب الكابشن + الصوت + الكابشن المرجعية + رابط/موضوع السكربت.
  التحميل بعد أول hydration (متوافق مع SSR — القيم الافتراضية تُصيَّر أولاً)، والحفظ بعد debounce ‏300ms، و فشل الحفظ لا يكتشع عرض المحرّر.
- بالمحتوي ذلك: الصوت (audioUrl من Blob العام) والكابشنات يُعادان من آخر جلسة — المستخدم يحتاج فقط إعادة التصيير لا الصوت.
- حدود الشريحة: localStorage لكل جهاز فقط (لا مشاركة عبر أجهزة ولا حساب) — النموذ الكامل (قاعدة بيانات + مصادقة + سيرة تصييرات) تظل خطة المرحلة 4 الكاملة وتحتاج حسابات.

### ملاحظات التنفيذ (المرحلة 2 — صور AI + Azure fallback)

- `src/lib/background-images.ts`:
  - توليد خلفية لكل فيديو عبر REST ‏(`responseModalities: ["TEXT","IMAGE"]`) — عائلة Nano Banana؛ النموذج عبر `GEMINI_IMAGE_MODEL` (افتراضي `gemini-nano-banana-2.1` بمواصفات يوتيوب 2026).
  - **كاش محتمل**: مسار Blob حتمي `backgrounds/{sha256(model+prompt,32)}.png` — فحص `head` قبل الدفع؛ نفس الـ prompt = URL جاهز بصفر تكلفة توليد.
  - برومبت مُصفّى (بلا markdown) بلاحقة تضمن 9:16 خلفية بلا نص، ثم رفع بصيغة Blob مع `addRandomSuffix:false`.\
  - وُحّدت قراءة `BLOB_READ_WRITE_TOKEN` من البيئة (المرمر الصريح اختياري)، والاختبارات تُقرأ من البيئة مباشر.
- `POST /api/image`: زود ‏`styleHint` اختياري، وفحص حد 8/10 دقائق.
- المحرّر: زر «خلفية AI» (برومبت مرسوم من الخطاف/مشهد أول) + عرض الحالة (كاش/AI/خطأ) + إزالة الخلفية — تُمرر إلى ‏`inputProps[].backgroundMedia` بمواصفات 1.08/‏0.45.
- `src/lib/azure-tts.ts`: التوليد عبر REST الرسمي (توكن → ‏SSML → mp3 48kbitrate)، بلا تكلفة مجهولة أو برمز صوت يدوي؛ يعمل فقط مع مفاتيح ‏`AZURE_SPEECH_KEY/REGION`، والكابشن تُوظَّف مي我怕ةً (Edge يظل اسانراووى مع كلمات بدقيقة عندما يجهز).
- `tts.ts`: بعد 3 محاولات Edge مطروحة مع تأخيرات تصاعدية → مكمل Azure إن تُهيأت المفاتيح؛ وخطوة التكليف بالكلك المتراكم كرد واضح من الخادم (معرّفات الخطين معاً).
- ‏`render-cache.ts`: القياس يُعتمد الآن على منذ الرجوع noy accidentally (BlobNotFoundError بُسّط — لا فرن الأعطال سلوكها لأن كلاهما يُعدو الكاش فقط). This was a도 ر revealed by mock mixing in tests.
- ‏بند المرحلة 3 رقم 6: ‏`concurrency` 1 إنتاج (2 vCPU) / 2 محلي، وجودة JPEG 80 صريحة (زاوية الجودة/الذاكرة الثابتة وثابتة من الوثائق).

### ملاحظات التنفيذ (المرحلة 2 — /api/script)

- `src/lib/script-generator.ts`:
  - **الاستخراج**: ‏`fetch` + ‏cheerio — يقرأ ‏`article` ثم `main` ثم `body`، ويقصّ سكريبتات/أنماط/ترويسات/تذييلات/nav/iframe، ويحد النص بـ 15k حرف (توفير توكنات).
  - **النموذج**: ‏Gemini REST صريح ‏(`generateContent` + `responseMimeType: application/json`) — بلا SDK إضافي. النموذج عبر `GEMINI_MODEL` (افتراضي `gemini-2.0-flash`) والمفتاح `GEMINI_API_KEY` على الخادم فقط.
  - **مخطط الرد**: zod ‏(hook ≤ 160 + 3–10 مشاهد ≤ 280 حرفاً + `.strict()` يمنع حقول زائدة) مع تفكيك JSON مرن (يقاوم التغليف النصي ```json).
  - برومبت عربي/إنجليزي حسب `lang`، بـ CTA في آخر مشهد، وبلا markdown.
- `POST /api/script`: ‏executeApi + مخطط يطلب رابطاً أو موضوعاً (`refine`) + ‏rate-limit ‏6/10 دقائق (LLM مكلف نسبياً).
- المحرّر: حقل "رابط مقال أو موضوع…" + زر "اقتراح سكربت" يملأ الخطاف والمشاهد، ويعيد حالة TTS إلى idle (الصوت القديم لم يعد مطابقاً).
- الاختبارات (8، بلا شبكة عبر fetch مُحقن): استخراج المقال، مخطط الرد، مسار كامل رابط→استخراج→LLM→مشاهد مرقمة، فشل 404، رد بلا JSON، غياب المفتاح.
- حدود القرار: بلا كاش سكربتات الآن (الطلب مكلف للمستخدم لا للخادم بحد معدل)؛ كاش الصور (بند المرحلة 2 الثاني) مستقل عن هذا.

### ملاحظات التنفيذ (المرحلة 3 — قفل التصيير الموزّع)

- `src/lib/render-lock.ts`: ‏`acquireRenderLock` عبر ‏`SET key NX EX 600` في Upstash — مستخدُم واحد = تصيير واحد نشط **في كل نسخ Vercel**
  (ما لم يكن سابقاً قاعدة بيانات كاملة؛ Upstash يكفّي للحجم الأولي). الـ TTL ×10 دقائق يُحرّر القفل تلقائياً إذا ماتت العملية.
  بلا مفاتيح → خريطة محلية 1:1 (قابلة للاختبار بمعامل `now` قابل للحقن). الأخطاء → سقوط شفاف محلي (fail-open مثل rate-limit).
- `src/lib/upstash-redis.ts`: عميل REST خامل مُخزّن مشترك بين rate-limit والقفل (يُبنى مرة واحدة، و ‏`resetUpstashRedisForTests` لإعادة البناء بعد تغيير مفاتيح البيئة).
- الدمج في `/api/render`: القفل يُشترى قبل التدفق كله (قبل فحص الكاش)، ويُحرَّر في `finally` من `runRender` دائماً (نجاح/فشل/كاش). الرفض يعيد ‏429 برسالة مخصصة: "لديك عملية تصيير جارية حالياً — انتظر انتهاءها أولاً".
- ‏`rateLimitedResponse(retryAfterSec, message?)` أصبح يقبل رسالة مخصصة — الاستدعاء القديم في `/api/tts` لم يتغير.
- البنية الاختبارية: `src/lib/upstash-test-mocks.ts` محاكاة مشتركة عبر `mock.module` + حالة مُفرَغة قابلة للضبط — بحيث تُؤكَّد الاختبارات على مسار Redis الفعلي (بناء العميل، `set`/`del`/`fixedWindow`) بدل مرور الاختبار ضمنياً عبر fallback المحلي.
- توسّع لاحق: التحول إلى طابور كامل بجدول jobs + ‏Vercel Cron (المرحلة 4) عند الحاجة لإعادة محاولة تلقائية، وليس قبل الحاجة.

- `src/lib/rate-limit.ts` أُعيدت كتابته فوق `@upstash/ratelimit` + `@upstash/redis` (إصدارات مثبتة: ‏ratelimit ‏^2.2.0 / redis ‏^1.39.0):
  - **نفس الواجهة** السابقة (`checkRateLimit(key, limit, windowMs)` — أصبح async، والمسارِان ينتظران `await`).
  - وجد `UPSTASH_REDIS_REST_URL` + ‏`UPSTASH_REDIS_REST_TOKEN` → نافذة ثابتة (`fixedWindow`) تُحصى في Redis — صحيحة عبر كل نسخ Vercel.
  - لا مفاتيَح (تطوير محلي) → سلوك الذاكرة المحلية القديم 1:1 (`inMemoryCheckRateLimit` مُستخرَج وقابل للاختبار).
  - خطأ Upstash (شبكة...) → سقوط شفاف للذاكرة المحلية ولا يُعطّل التصيير (fail-open، مع `console.warn`).
  - `analytics: false` — لا مهام خلفية تنتظر `waitUntil` بعد الرد.
  - نسخ Ratelimit تُخزَّن لكل (limit, window) مرة واحدة — بلا استهلاك صحيح متكرر.
  - خوارزمية النوافذ الثابتة في Upstash تحاذي حدود الزمن المطلق (أضعاف windowMs) بينما المحلية تبدأ من أول طلب — فرق حواف نافذة فقط.
- لتفعيلها في الإنتاج: أنشئ قاعدة Redis في console.upstash.com ثم أضف `UPSTASH_REDIS_REST_URL` و ‏`UPSTASH_REDIS_REST_TOKEN` إلى متغيرات البيئة في Vercel (محلياً يعمل fallback الذاكرة بلا مفاتيح). البادئة `@my-video/ratelimit` لتجنب تصادم المفاتيح مع تطبيقات أخرى تشارك القاعدة.

### ملاحظات التنفيذ (المرحلة 3 — جلسة sandbox)

- `src/lib/sandbox-session.ts`: بدل `stop()` بعد كل طلب، تُحفظ الجلسة في `Map` على مستوى العملية وتُوقَف فقط بعد خمول **90 ثانية**
  (`SANDBOX_IDLE_STOP_MS`) — التعديل الصغير ثم إعادة التصيير تعيد استخدام الـ sandbox نفسه بصفر وقت إنشاء/تثبيتات/متصفح.
- الصيانة على طبقتين: مؤقّت خمول `unref` (يعمل محلياً) + `stopStaleSandboxSessions()` عند كل طلب طِباق محتمل (شرط احتياطي لو تعلّقت دالة serverless).
- عند النجاح: ‏`holdSessionSandbox` يمدّد timeout الـ sandbox ‏(`extendTimeout` بخمول + 30 ثانية هامش) حتى لا ينتهي تلقائياً أثناء الخمول.
- عند أي فشل: تُحذف الجلسة (`dropSessionSandbox`) — لا إعادة استخدام مع sandbox بحالة مجهولة.
- تدفّق الطلب أصبح خطياً بدل متداخل: الكاش **قبل** أي sandbox → جلسة قائمة أو إنشاء → تصيير/رفع → ‏hold أو ‏stop → رسالة `done` واحدة، ورسالة `error` واحدة عند الفشل.
- محاولة إعادة **واحدة فقط** عند خطأ sandbox توقفت فجأة (انتهى timeout بين الطلبات) — التشخيص عبر `sandbox_stopped`/`expired` في الرسالة.
- الإغلاق عبر `writer.close()` في `finally` مع `.catch(()=>{})` — آمن مع عبارات return الداخلية.
- المحلي: لا جلسات — نوقف الـ sandbox كالسابق لأن الحزمة تُبنى وتُرفع من جديد كل مرة على أي حال.
- حدود القرار: reuse يقتصر على الطلبات عبر **نفس عملية الخادم** — في serverless قد تُنفَّذ طلبات مختلفة على عمليات منفصلة فيكون التوفير جزئياً؛ يكفي للمعدل الحالي (5/ساعة/مستخدم) ويُقاس بالأرقام الحية من سجل `render-metrics`.

### ملاحظات التنفيذ (المرحلة 3 — كاش + قياس)

- `src/lib/render-cache.ts`: مفتاح حتمي `renders-cache/{compositionId}/{sha256(48)}.mp4` من **توصيف JSON مستقر** (ترتيب مفاتيح محدد + تجاهل `undefined`) — لا يعتمد على ترتيب إدخال الكائنات من العميل.
- الفحص عبر `head()` **قبل إنشاء الـ sandbox**: نفس التكوين = رابط جاهز فوراً بصفر تكلفة تصيير. فشل الفحص (غير "غير موجود") لا يفرط في الخطأ — يعطل الكاش فقط ولا يوقف التصيير.
- الرفع يستخدم `uploadToVercelBlob({ blobPath: cachePath })` — نفس المسار الحتمي، فتلتقنه `head()` في المرة القادمة. ملاحظة: `put()` الافتراضي `allowOverwrite=false` ⇒ سباق نادر عند تصيير نفس التكوين مرتين بالتوازي.
- `src/lib/render-metrics.ts`: تسعير iad1 الرسمي (2026-10): Active CPU ‏$0.128/vCPU-ساعة، Memory ‏$0.0212/GB-ساعة، شبكة صادرة ‏$0.15/GB. عدد vCPUs يُمرر صراحة (`Sandbox.create({resources})` في مسار الـ snapshot = 2، و 4 افتراضياً محلياً).
- Active CPU لا يُقاس من الكود ⇒ نسبة استغلال افتراضية **0.6** مع تسجيل `sandboxWallSeconds` الفعلي دوماً؛ تُعاير لاحقاً بمطابقة لوحة Vercel.
- سجل المقاييس: سطر JSON واحد لكل عملية (نجاح/كاش/فشل) بمفتاح `event:"render-metrics"` قابل للفلترة في Vercel Logs.
- العملية الفاشلة تُسجّل في `finally` أيضاً (خسارة الـ sandbox تُحتسب) — بعَلَم `metricsLogged` لمنع تكرار التسجيل مع مسار النجاح.
- رسالة `done` عبر SSE أصبحت تحمل `cached` و ‏`metrics` (ثواني + ‏$) وتُعرض في المحرّرين مباشرة للمستخدم.

### ملاحظات التنفيذ (المرحلة 1)

- حُدِّث `package.json` بإضافة `@remotion/captions@4.0.535` و `@remotion/layout-utils@4.0.535` (نسخ مطابقة لبقية حزمة Remotion).
- أُضيف `captionStyle` و `backgroundMedia` إلى `ShortProps` مع `.default()` — لاحق متوافق مع الطلبات القديمة لـ `/api/render`.
- `fitText` يُستدعى **مرة لكل صفحة** (وليس كل إطار) لتجنب قياس DOM متكرر — `fontSize` مُخزّن في `useMemo` مربوط بمرجع الصفحة.
- حبيبات الحجم تُحسب بـ `spring({damping:200})` للدخول ثم `interpolate` للخروج، باستخدام `min(enter, exit)` لمنع القطع المفاجئ.
- اتجاه تعبئة الكاريوكي ينقلب تلقائياً للعربية (`270deg`) مقابل الإنجليزية (`90deg`).

### التحقق

| الفحص | النتيجة |
|---|---|
| `npx tsc --noEmit` | ✅ نظيف |
| `npx eslint` (ملفات معدّلة) | ✅ نظيف |
| `npm test` (bun) | ✅ 91/91 عبر 15 ملفاً |
| `npm run build` (Next 16 + Turbopack) | ✅ نجح (شامل مسارات SaaS الجديدة) |

> أُعيد التحقق في 2026-10-16: `tsc` و`eslint` (النطاق الكامل `src types scripts`) نظيفان — خطأا `sec-ms-gec.ts` القديمان أُصلحا ضمن التعديلات اللاحقة.

---

## الاستئناف — جلسة الغد (نقطة التوقف 2026-10-16 مساءً)

- **الحالة**: `HEAD = 246f06f` مدفوع، الشجرة نظيفة، الفحوص خضراء (`tsc`/`eslint`/`bun test 91/91`/`build`).
- **المفاتيح محلياً** (`.env.local` — مفحوص بلا كشف قيم): موجود فقط `BLOB_READ_WRITE_TOKEN`. **ناقص 11**: `UPSTASH_REDIS_REST_URL`، `UPSTASH_REDIS_REST_TOKEN`، `GEMINI_API_KEY`، `AZURE_SPEECH_KEY`، `AZURE_SPEECH_REGION`، `DATABASE_URL`، `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`، `CLERK_SECRET_KEY`، `STRIPE_SECRET_KEY`، `STRIPE_WEBHOOK_SECRET`، `CRON_SECRET`.
- **قاعدة**: لا كلمات مرور ولا مفاتيح في المحادثة أبداً — تُلصق مباشرة في Vercel (تُشفَّر وتُخفى).

### قائمة الغد (بالترتيب)

- [ ] Vercel ← Settings ← Environment Variables (Production): أضف المفاتيح الناقصة أعلاه (Neon وUpstash عبر Storage ← Create يحقنان تلقائياً؛ `CRON_SECRET` قيمة عشوائية من `openssl rand -hex 32`) ثم **Redeploy**.
- [ ] الهجرة على إنتاج Neon: `npx drizzle-kit migrate` (يحتاج `DATABASE_URL`).
- [ ] Stripe (وضع Test): مفتاح + webhook إلى `/api/billing/webhook`، واشترِ حزمة تجريبية للتأكد من إضافة الكريدت.
- [ ] جولة الدخان: دخول → تصيير (خصم 1 كريدت) → سطر `render-metrics` في السجلات → **غياب** تحذير "بلا مصادقة".
- [ ] بعده (قرارات): سياسة الاحتفاظ/الحذف، معايرة أسعار الحزم مقابل $/video، وميزة القوالب الجاهزة (غير موجودة — الوحيدة الباقية من خطة المرحلة 4).
