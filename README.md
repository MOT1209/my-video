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
- بدون `BLOB_READ_WRITE_TOKEN` يعمل الصوت محلياً لكن التصيير يفشل.

## حدود الاستخدام (Rate Limiting)

حماية أولية لكل IP (ذاكرة محلية — عند التوسع انقل إلى Vercel KV):
- الصوت `/api/tts`: **20 طلب / 5 دقائق** — الرد 429 مع رسالة عربية و`Retry-After`.
- التصيير `/api/render`: **5 عمليات / ساعة** (التصيير مكلف: دقائق sandbox).

## الأوامر

```bash
npm run dev          # خادم التطوير
npm test             # اختبارات الوحدة (bun test — حالياً 11 اختباراً)
npm run lint         # فحص ESLint (يستبعد .agents/ و .claude/)
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
| `src/lib/rate-limit.ts` | حد المعدل لكل IP |
| `src/app/api/render/` | التصيير عبر Sandbox + رفع Blob (SSE) |
| `scripts/cleanup-blobs.ts` | تنظيف الملفات القديمة من Blob |
| `types/shorts.ts` | الأنواع والقواعد (60 ثانية، 12 مشهد) |

## اعتبارات الإنتاج

- فعّل [Vercel Spend Management](https://vercel.com/docs/accounts/spend-management) للتحكم بالتكاليف.
- نظّف الـ snapshots والفيديوهات القديمة دورياً (`npm run cleanup-blobs -- --delete`).
- الـ Blob store يجب أن يقبل **public access** (الفيديوهات والصوتيات تُخدم بروابط عامة).

## النشر على Vercel

1. من لوحة التحكم: Storage ← Create ← Blob، وأنشئ store بإعداد **public** واربطه بالمشروع.
2. يُضاف `BLOB_READ_WRITE_TOKEN` تلقائياً لبيئات المشروع — ثم أعد النشر.

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
