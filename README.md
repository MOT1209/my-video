# my-video — Shorts عمودية 9:16 (Remotion + Next.js)

تطبيق توليد فيديوهات Shorts عمودية: Hook + مشاهد + تعليق صوتي Edge-TTS + كابشن كلمة-كلمة، معاينة عبر `@remotion/player` وتصيير عبر Vercel Sandbox + تخزين Blob.

الموقع الحي: `https://my-video-kappa-one.vercel.app`

## سير عمل Shorts

1. اكتب **الخطاف** (حتى 120 حرف — أول 2.5 ثانية) والمشاهد (سطر = مشهد، حتى 12 مشهد، 280 حرف للمشهد).
2. اختر الثيم (`dark` / `paper` / `neon` / `news` / `quotes`) والصوت (عربي: زارية/حامد، إنجليزي: Ava/Andrew).
3. اضغط **توليد الصوت** — يُولّد mp3 عبر Edge-TTS (مع توكن Sec-MS-GEC v2) مع كابشن بمستوى الكلمة، ويُحفظ في الكاش (Blob إن توفر وإلا `public/audio`).
4. عاين الفيديو 9:16 (1080×1920، 30fps) — المدة تُحسب من آخر كلمة + ثانية أمان، بسقف 60 ثانية ليوتيوب Shorts.
5. اضغط **تصيير الفيديو** — يُصيّر عبر `/api/render` ويُرفع إلى Blob مع رابط تحميل.

ملاحظات:
- النص الكامل = Hook + المشاهد، الحد 1000 حرف (`MAX_TTS_CHARS` في `src/lib/tts.ts`).
- الكاش بمفتاح hash (`voiceId::text`) — نفس النص لا يُولّد مرتين.
- بدون `BLOB_READ_WRITE_TOKEN` يعمل الصوت المحلي عند توفر fallback لكن التصيير يعيد 503.

## حدود الاستخدام (Rate Limiting)

حماية عبر **Upstash Redis** (موزّعة عبر النسخ، وبحسب المستخدم المصادَق أو IP للتطوير المحلي):
- الصوت `/api/tts`: **20 طلب / 5 دقائق** — الرد 429 مع رسالة عربية و`Retry-After`.
- التصيير `/api/render`: **5 عمليات / ساعة** (التصيير مكلف: دقائق sandbox).

## الأوامر

```bash
npm run dev           # خادم التطوير
bun test src/lib types # اختبارات الوحدة (Bun)
npm run lint          # فحص ESLint (يستبعد .agents/ و .claude/)
npm run cleanup-blobs            # عرض Blobs الأقدم من 30 يوم (dry-run)
npm run cleanup-blobs -- --delete --older-than-days=7   # حذف فعلي
npx remotion studio  # Remotion Studio
```

## البنية

| المسار | الدور |
|---|---|
| `src/remotion/Shorts/` | تكوين الفيديو (خلفية + عنوان + بطاقات + كابشن) |
| `src/components/ShortsEditor.tsx` | المحرر والمعاينة والتصيير |
| `src/app/api/tts/` | توليد الصوت + الكاش |
| `src/lib/edge-tts.ts` | عميل Edge TTS (WebSocket + حدود الكلمات) |
| `src/lib/sec-ms-gec.ts` | توكن Sec-MS-GEC v2 (نقل مطابق للمكتبة الرسمية، مُغطى باختبارات) |
| `src/lib/rate-limit.ts` | حد المعدل (Upstash Redis؛ fallback محلي خارج الإنتاج فقط) |
| `src/lib/azure-tts.ts` | fallback رسمي للصوت (يعمل مع `AZURE_SPEECH_KEY/REGION`) |
| `src/app/api/script/` | رابط/موضوع ← سكربت عبر Gemini |
| `src/app/api/image/` | خلفيات AI + كاش content-hash |
| `src/lib/render-cache.ts` | كاش ناتج التصيير (مفتاح حتمي) |
| `src/lib/render-metrics.ts` | قياس $/video |
| `src/app/api/render/` | التصيير عبر Sandbox + رفع Blob (SSE) |
| `.github/workflows/my-video-ci.yml` | تحقق CI لتطبيق Next.js في الجذر |
| `scripts/cleanup-blobs.ts` | تنظيف الملفات القديمة من Blob |
| `types/shorts.ts` | الأنواع والقواعد (60 ثانية، 12 مشهد) |

## مسارات SaaS (المرحلة 4)

| المسار | الدور |
|---|---|
| `src/app/api/projects/` + `[id]` | حفظ/تحميل/حذف مشاريع المستخدم |
| `src/app/api/renders/` | سجل التصييرات وإعادة التنزيل |
| `src/app/api/credits/` | رصيد الكريدت الحالي |
| `src/app/api/billing/checkout` | إنشاء جلسة Stripe لشراء حزمة |
| `src/app/api/billing/webhook` | استقبال أحداث Stripe (بتحقق التوقيع) |
| `src/app/api/cron/retry-renders` | إعادة محاولة التصييرات الفاشلة (يحميه `CRON_SECRET`) |
| `src/app/api/transcribe/` | تحويل صوت مرفوع إلى نص (Gemini ASR) |
| `src/app/sign-in/` | تسجيل الدخول (Clerk) |

نموذج الكريدت (`src/lib/credits.ts`): تصيير واحد = 1 كريدت، 3 مجانية عند التسجيل، والحزم 10 بـ$5 و30 بـ$12 و100 بـ$35. الكريدت يُخصم بعد تأكد غياب الكاش ويُرجَع عند فشل التصيير.

## اعتبارات الإنتاج

- فعّل [Vercel Spend Management](https://vercel.com/docs/accounts/spend-management) للتحكم بالتكاليف.
- نظّف الـ snapshots والفيديوهات القديمة دورياً (`npm run cleanup-blobs -- --delete`).
- الـ Blob store يجب أن يقبل **public access** (الفيديوهات والصوتيات تُخدم بروابط عامة).

## النشر على Vercel

1. من لوحة التحكم: Storage ← Create ← Blob، وأنشئ store بإعداد **public** واربطه بالمشروع.
2. يُضاف `BLOB_READ_WRITE_TOKEN` تلقائياً لبيئات المشروع — ثم أعد النشر.

## النشر الكامل (ميزات الحساب)

ميزات الحساب اختيارية محلياً، لكن مفاتيح Clerk وNeon وUpstash وBlob مطلوبة لمسارات التصيير الإنتاجية؛ غيابها يؤدي إلى رفض آمن (401/503) ولا يفتح التصيير أو يتجاوز الحدود:

1. **Neon**: أنشئ قاعدة من console.neon.tech، أضف `DATABASE_URL`، ثم طبّق الهجرة: `npx drizzle-kit migrate`.
2. **Clerk**: أضف `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` و`CLERK_SECRET_KEY`؛ الطلبات غير المصادقة تُرفض، وغيابهما في الإنتاج يُرفض أيضاً.
3. **Stripe**: أضف `STRIPE_SECRET_KEY` ووجّه الـ webhook إلى `/api/billing/webhook` مع `STRIPE_WEBHOOK_SECRET`.
4. **Upstash**: أضف `UPSTASH_REDIS_REST_URL` و`UPSTASH_REDIS_REST_TOKEN` للحد والقفل الموزعين. لا يُستخدم fallback محلي في الإنتاج؛ فشل Redis يعيد 503.
5. **Cron**: أضف `CRON_SECRET` واضبط مهمة Vercel Cron على `/api/cron/retry-renders`.

## فحوص CI

يُشغّل `.github/workflows/my-video-ci.yml` فحوص تطبيق Next.js في جذر المستودع (lint، اختبارات Bun، TypeScript، build) بشكل مستقل عن سير عمل King Browser. لأوامر التحقق المحلية استخدم `bun test src/lib types` ثم `npx tsc --noEmit` و`npm run lint` و`npm run build`. مفاتيح Google AI تُرسل من الخادم فقط؛ راجع سجلات الطلبات عند تشخيص أخطاء مزود الخدمة.

## التطوير المحلي

```bash
vercel login
vercel link
vercel env pull .env.local   # يسحب BLOB_READ_WRITE_TOKEN
npm run dev
```

## توثيق إضافي

- `report.html` — تقرير المراجعة والتطوير الكامل (يُفتح في المتصفح).
- عن القالب الأصلي: [Remotion on Vercel](https://remotion.dev/docs/vercel-sandbox) — [Discord](https://remotion.dev/discord).

## الرخصة

لبعض الاستخدامات يلزم ترخيص شركة. [الشروط هنا](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
