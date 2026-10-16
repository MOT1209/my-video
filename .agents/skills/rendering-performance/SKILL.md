---
name: rendering-performance
description: خفض تكلفة التصيير وقياسها — كاش حتمي ومقاييس $/video وسجلات آمنة وتنظيف الأصول
version: 1.0.0
---

# Rendering Performance & Observability

حين يعمل الوكيل على زمن/تكلفة التصيير أو التخزين المؤقت أو المراقبة، اتبع هذا الـ skill. المرجع: `src/lib/render-cache.ts` + `src/lib/render-metrics.ts` + `src/app/api/render/route.ts`.

## الوضع الحالي (لا تعده بلا قياس)

- كاش ناتج حتمي `renders-cache/<composition>/<sha256:48>.mp4` عبر `stableStringify` + فحص `head()` قبل sandbox (قيد التنفيذ في الشجرة — المرحلة 3).
- مقاييس `$`: أسعار iad1 ‏(Active CPU ‏$0.128/vCPU-h، Memory ‏$0.0212/GB-h، شبكة ‏$0.15/GB) مع افتراض استغلال 0.6 وتسجيل `sandboxWallSeconds` الفعلي دائماً.
- `done` عبر SSE تحمل `cached` و`metrics` وتُعرض في المحرر. الفشل يُسجَّل في `finally` (الخسارة تُحتسب) بمنع التكرار.
- قرار المرحلة 3: **البقاء على Sandbox** ما لم يتجاوز `$0.05/فيديو` أو 90 ثانية — راجع القرار عندها (Lambda ~$0.10/60s لكن أسرع).

## متى يُفعَّل

- أي تغيير يمس زمن التصيير، إصابات الكاش، بدء/استعادة sandbox، مهلات/إعادة، رفع Blob، سجلات، تقديرات تكلفة، تنظيف أصول.

## ملفات يجب فحصها أولاً

- `src/lib/render-cache.ts` (`RENDER_CACHE_PREFIX`، `stableStringify`، `renderCachePath`، `findCachedRender` — لا يفرط بالخطأ أبداً).
- `src/lib/render-metrics.ts` (الثوابت السعرية، `PROD_SANDBOX_VCPUS=2` مقابل `DEV=4`، `estimateRenderCostUsd`، `logRenderMetrics` بحدث `render-metrics`).
- `src/app/api/render/route.ts` (فحص الكاش قبل sandbox، الرفع للمسار الحتمي، `sandbox.stop()` في `finally`).
- `src/app/api/render/restore-snapshot.ts` و`helpers.ts` (الاستعادة والتجميع)، `scripts/cleanup-blobs.ts` (تنظيف >30 يوم dry-run).

## سير العمل

1. **قِس أولاً**: سجّل الأساس (`sandboxWallSeconds`، إصابة الكاش، بايتات Blob، التزامن) قبل أي تحسين. لا استبدال للمُصيّر دون سبب مُقاس.
2. **الكاش**: المفتاح `sha256(compositionId + inputProps)` المستقر فقط. أي حقل يؤثر بصرياً/سمعياً يدخل المفتاح؛ أي حقل تجميلي (مثل `subtitle` مرحلة) لا يدخله. تحقق من تضارب الهاش باختبار.
3. **التكلفة**: `estimateRenderCostUsd({sandboxWallSeconds, vcpus, blobBytes})` — اذكر الافتراضات (0.6 استغلال، أسعار iad1 بتاريخها) وحدودها (Active CPU غير مُقاس — عايِر مع لوحة Vercel).
4. **السجلات**: سطر JSON واحد `event:"render-metrics"` لكل عملية (نجاح/كاش/فشل) — بلا نصوص مستخدم ولا مفاتيح ولا URLs موقعة.
5. **التنظيف**: `npm run cleanup-blobs` (عرض >30 يوم) والحذف الصريح `--delete --older-than-days=7`. أي سياسة حذف تلقائي تتطلب موافقة وتوثيق احتفاظ.

## المعايير

- `head()` قبل sandbox دائماً؛ فشل الفحص (غير "غير موجود") = تعطيل كاش فقط.
- `put()` الافتراضي `allowOverwrite=false` — سباق التوازي النادر على نفس المفتاح مقبول وموثق؛ لا تخفه.
- أغلق sandbox في `finally` دائماً. سجّل الفشل الطويل (>3s) كخسارة.
- `jpegQuality` و`--concurrency` تُضبط حسب vCPU الفعلي (مكسب 10–20% متوقع — قِسه).

## معالجة الأخطاء

- Blob خاص → رسالة public-access (نمط `BlobAccessError`). مهلة sandbox → حدث `error` + إغلاق + تسجيل. شبكة رفع فشلت بعد render ناجح → أعد الرفع لا إعادة التصيير حيث أمكن.

## الاختبار (`bun test`)

- غطِّ: استقرار المفتاح (ترتيب مختلف = نفس الهاش؛ `undefined` مُتجاهَل)، `findCachedRender` (موجود/مفقود/خطأ عابر)، تقدير التكلفة (صفر sandbox = صفر CPU/ذاكرة)، عدم تسرب الكاش عبر مستخدمين عند إدخال بيانات خاصة (اختبار عزل المفتاح).
- لا تدّعِ تحسناً دون أرقام قبل/بعد (ثوانٍ + `$` + نسبة إصابة).

## معايير القبول

- كل تغيير أداء مدعوم بقياس. مفاتيح الكاش تميّز المدخلات المختلفة فعلاً. لا تسرب أسرار/بيانات في السجلات. تقديرات التكلفة تذكر افتراضاتها.

## القيود

- ممنوع تخزين بيانات مستخدم خاصة تحت مفتاح مشترك دون عزل (`userId` في المسار عند تعدد المستخدمين — راجع `saas-product-engineering`).
- ممنوع حذف أصول Blob تلقائياً دون سياسة احتفاظ معتمدة.
