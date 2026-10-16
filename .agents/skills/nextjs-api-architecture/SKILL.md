---
name: nextjs-api-architecture
description: بنية API متينة في Next.js + TypeScript صارم + Zod — عقود مستقرة وأخطاء موحدة وطبقات خدمة قابلة للاختبار
version: 1.0.0
---

# Next.js API & TypeScript Architecture

حين يعمل الوكيل على أي مسار `/api/*` أو طبقة خدمة أو schema مشترك، اتبع هذا الـ skill.

## الوضع الحالي (اقرأ قبل التعديل)

- المسارات: `src/app/api/tts/route.ts` (JSON) و`src/app/api/render/route.ts` (SSE عبر `TransformStream` + `waitUntil`).
- المساعد: `src/helpers/api-response.ts` (`executeApi(schema, handler)` — يرد `{type:"success",data}` أو `{type:"error",message}` بحالة 500 حالياً).
- العقود: `types/schema.ts` (`AnyRenderRequest`، `ShortRenderRequest`، `SSEMessage`) و`types/shorts.ts` (`ShortProps` مع `.default()` للتوافق الخلفي) و`types/constants.ts` (MyComp القديم).
- الخدمات: `src/lib/tts.ts`، `src/lib/edge-tts.ts`، `src/lib/rate-limit.ts`، `src/lib/render-cache.ts`، `src/lib/render-metrics.ts`.

## متى يُفعَّل

- مسار جديد، تغيير schema، طبقة خدمة جديدة، توحيد أخطاء، فصل منطق عن handlers، تحديث بيئة. **لا تفعّله** لتعديل مكونات Remotion البصرية.

## المدخلات والمخرجات

- **مدخلات**: JSON مُتحقق بـ Zod. **مخرجات**: `ApiResponse` أو أحداث SSE من `SSEMessage`. لا تُرجع كائنات داخلية (مفاتيح، مسارات ملفات، stack traces) للعميل.

## سير العمل

1. عرّف/حدّث schema Zod في `types/` أولاً (مع `.default()` للحقول الجديدة للحفاظ على التوافق الخلفي — نمط `captionStyle` و`backgroundMedia`).
2. ضع المنطق في `src/lib/<domain>.ts` كدوال خالصة قابلة للاختبار؛ الـ `route.ts` يتحقق → يستدعي الخدمة → ينسّق الرد فقط.
3. استخدم `executeApi` لمسارات JSON. لمسارات SSE انسخ عقد `src/app/api/render/route.ts` (ترميز `formatSSE`، إغلاق `writer` في كل المسارات بما فيها `finally`).
4. فرّق حالات الخطأ: `400` لمدخل مرفوض (Zod)، `429` للحدود (مع `Retry-After`)، `500` لفشل داخلي برسالة عامة. لا تُرجع 500 على خطأ عميل.
5. تحقق من البيئة عند بدء المسار (`BLOB_READ_WRITE_TOKEN` نمطاً) برسالة إصلاح عربية واضحة لا تسرب أسراراً.

## المعايير

- TypeScript صارم: ممنوع `any` جديد وممنوع `// @ts-ignore`/`eslint-disable` دون تعليق سبب + مهمة إزالة. فضّل `z.infer` للأنواع المشتقة و`unknown` + تضييق عند الحدود.
- `stableStringify`-نمطاً لأي مفتاح حتمي (ترتيب مفاتيح محدد + تجاهل `undefined`) — راجع `src/lib/render-cache.ts`.
- لا منطق أعمال داخل `route.ts` يتجاوز ~50 سطراً دون استخراج خدمة.
- التوافق الخلفي: أي حقل جديد اختياري بـ default؛ أي كسر عقد يتطلب موافقة صريحة وتحديثاً متزامناً للعميل (`ShortsEditor`/`use-rendering`) والاختبارات.

## الأمان

- تحقق من كل مدخل عند الحدود (Zod). قيّد الأطوال (`text ≤1200` للـ TTS، `hook ≤120`، `scenes ≤12`) والأحجام قبل أي عمل مكلف.
- المفاتيح من `process.env` في الخادم فقط. لا `NEXT_PUBLIC_*` لأسرار. لا صدى للمفاتيح في الأخطاء/السجلات.
- راجع `api-security-cost-protection/SKILL.md` قبل أي مسار يقبل URL خارجياً أو يطلق عملاً مكلفاً.

## معالجة الأخطاء

- Zod فشل → `400` مع أول رسالة مفيدة (لا كومة كاملة). خدمة فشلت → `500` برسالة عامة + تفاصيل في سجل الخادم.
- مسارات SSE: حدث `{type:"error",message}` ثم إغلاق — لا تترك الدفق معلقاً. `finally` يُغلق دائماً.
- مهلات صريحة لكل عملية شبكة/ثقيلة (`timeoutMs` + `AbortController` حيث أمكن).

## الاختبار (`bun test`)

- غطِّ: قبول schema صالح، رفض كل حد (طول/عدد/URL)، توافق خلفي (طلب قديم بلا حقول جديدة ينجح)، تنسيق الخطأ (لا تسرب داخلي)، أحداث SSE (`phase → done/error` وإغلاق).
- لا تعتمد على Blob/Sandbox/API مدفوعة في الوحدة — احقن/زيف الحدود.

## معايير القبول

- العقود العامة محفوظة (أو كسر موثق ومعتمد).
- كل مسار: `400` للمدخل السيئ، لا تسرب داخلي، خدمة قابلة للاختبار بمعزل عن Next.
- لا `any` جديد ولا كتم أخطاء واسع.

## التوثيق

- أي مسار جديد: جدول في README (المسار + الحدود + مثال طلب/رد). أي تغيير عقد: سطر في وصف التغيير يذكر التوافق الخلفي.

## القيود

- ممنوع تحويل `executeApi` إلى 500 لكل شيء — فرّق الحالات.
- ممنوع وضع أسرار أو منطق عرض داخل `types/` — أنواع وعقود فقط.
