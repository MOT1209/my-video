# خارطة الطريق التنفيذية — my-video

> تاريخ الإنشاء: 2026-10-15
> الحالة: قيد التنفيذ (المرحلة 1)

---

## أولاً: الموقف الحالي

| المحور | الحالة |
|---|---|
| التصيير | Remotion 4.0.535 + Vercel Sandbox مع **snapshot cache** جاهز (`src/app/api/render/restore-snapshot.ts:30`) و SSE للتقدم |
| TTS | Edge-TTS غير رسمي + كاش بالـ hash + **WordBoundary events** تنتج `WordCaption[]` بالتوقيت (`src/lib/edge-tts.ts:129`) |
| الكابشن | ✅ توقيت دقيق، ❌ **لا حركة إطلاقاً** (تبديل حالة فوري عند حدود الكلمة) |
| الخلفيات | 5 ثيمات CSS ثابتة (تدرّجات + vignette) — لا صور، لا فيديو، لا حركة |
| الذكاء الاصطناعي | **لا شيء**: لا LLM، لا توليد صور، لا تلخيص مقالات |
| SaaS | لا قاعدة بيانات، لا مصادقة، لا اشتراكات، حالة العميل فقط |
| الاختبارات | `bun test` (11 اختباراً) |
| حدود المعدل | `/api/tts` = 20/5 دقائق، `/api/render` = 5/ساعة (ذاكرة محلية) |

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
2. **rate-limit بالذاكرة** لا ينطبق على production (عدة نسخ خلفية) — المرحلة 3.
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
| 2026-10-15 | المرحلة 3 — كاش ناتج التصيير + قياس $/video | ⏳ التالي |

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
| `npm test` (bun) | ✅ 11/11 |
| `npm run build` (Next 16 + Turbopack) | ✅ نجح |

> ملاحظة: `npm run lint` على المشروع كاملاً يُظهر خطأين قديمين في `src/lib/sec-ms-gec.ts:362-363` (`prefer-const`) — غير مرتبطة بهذه المرحلة.
