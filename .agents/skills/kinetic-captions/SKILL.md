---
name: kinetic-captions
description: كابشن متحرك متزامن كلمة-كلمة للفيديو العمودي (pop/karaoke/slide-up/glow) مع عربية RTL سليمة
version: 1.0.0
---

# Kinetic Captions & Arabic Typography

حين يعمل الوكيل على الكابشن المتحرك (`WordCaptions`) أو الطباعة العربية في الفيديو العمودي 9:16، اتبع هذا الـ skill. التنفيذ المرجعي: `src/remotion/Shorts/WordCaptions.tsx`.

## متى يُفعَّل ومتى لا

- **فعّله**: تعديل أنماط الكابشن، توقيت الكلمات، تخطيط الأسطر، تباين النص، دعم RTL/عربي-إنجليزي مختلط، إصلاح فيض النص خارج الإطار.
- **لا تفعّله**: توليد الصوت نفسه (استخدم `ai-voice-tts`)، توليد السكربت (استخدم `url-groq-video-generator`)، الخلفيات (استخدم `cinematic-media`).

## ملفات المستودع التي يجب فحصها أولاً

| الملف | لماذا |
|---|---|
| `src/remotion/Shorts/WordCaptions.tsx` | منطق الصفحات (`createTikTokStyleCaptions`) والحركة (`spring`/`interpolate`) وعنصر `TokenPill` |
| `src/remotion/Shorts/font.ts` | خط `NotoKufiArabic` (عربي + لاتيني، أوزان 400/700) — لا تستبدله دون اختبار تشكيل عربي |
| `types/shorts.ts` | `CaptionStyle` (pop/karaoke/slide-up/glow)، `WordCaption {word,start,end}` بالثواني، `SHORT_SAFE_BOTTOM=420`، `SHORT_WIDTH=1080` |
| `src/remotion/Shorts/Background.tsx` | لوحات `ShortPalette` الخمس — أي لون `accent` جديد يجب أن يبقى مقروءاً فوقها |
| `src/remotion/Shorts/ShortMain.tsx` | تمرير `accent` حسب الثيم و`captionStyle` إلى `WordCaptions` |

## المدخلات والمخرجات

- **مدخلات**: `captions: WordCaption[]` (ثوانٍ)، `lang: "ar" | "en"`، `style: CaptionStyle`، اختياري `combineMs` (الافتراضي 900).
- **مخرجات متوقعة**: صفحات TikTok (`TikTokPage`) تُعرض فوق منطقة الأمان، الكلمة النشطة مميزة حسب النمط، لا فيض أفقي في 1080px.
- **تحويل الأنواع**: `WordCaption {word,start,end (sec)}` → `Caption {text,startMs,endMs}` عبر `toRemotionCaptions` (تقريب صحيح للميلي-ثانية). لا تغيّر هذا التحويل دون تحديث `getShortDurationInFrames`.

## سير العمل الموصى به

1. اقرأ `WordCaptions.tsx` كاملاً قبل أي تعديل (ثوابت التخطيط أعلى الملف ملزمة: `HORIZONTAL_MARGIN=56`، `TOKEN_GAP=14`، `PILL_PAD_X/Y`).
2. أي نمط جديد يُضاف إلى `CaptionStyle` في `types/shorts.ts` **أولاً**، ثم يُنفَّذ في `TokenPill`، ثم يُسجَّل في `CAPTION_STYLE_LABELS` ومنتقي المحرر.
3. `fitText()` يُستدعى **مرة لكل صفحة** داخل `useMemo` (وليس كل إطار) — حافظ على ذلك لأنه يقيس DOM.
4. حركة الدخول `spring({damping:200})` بمدة `min(4, tokenFrames/2)` والخروج `interpolate` في آخر 4 إطارات، والفعلي `min(enter, exit)` — لا تستخدم `damping` منخفضاً (ارتداد) في فيديو قراءة سريعة.
5. الكاريوكي: اتجاه التعبئة `270deg` للعربية و`90deg` للإنجليزية (`dir === "rtl"`). أي نمط تعبئة جديد يجب أن ينقلب تلقائياً حسب `dir`.
6. تحقق من `SHORT_SAFE_BOTTOM + 60` كحشوة سفلية و`maxWidth = SHORT_WIDTH - 2*MARGIN` — لا تضع الكابشن خارج المنطقة الآمنة (أزرار YouTube/TikTok).

## معايير التنفيذ

- الحتمية: نفس `captions + frame + fps` = نفس الإطار دائماً. ممنوع `Math.random` أو `Date.now()` داخل المكون.
- `whiteSpace: "pre"` داخل الحبة لمنع تمدد الفراغات، و`transformOrigin: "center bottom"`.
- التباين: حبة داكنة `rgba(0,0,0,0.35)` + ظل `0 2px 12px rgba(0,0,0,0.6)`. أي تخفيف للخلفية يجب أن يقابله تعتيم إضافي من `cinematic-media` (`dim`).
- الخط: `fontWeight 700` للكابشن. لا تستخدم وزناً غير محمّل في `font.ts` (سيعود لخط احتياطي مختلف في الـ render عنه في الـ preview).

## الأمان

- نص الكابشن يُعرض كنص (`{visible}`) — لا تبنِ `dangerouslySetInnerHTML` من نص TTS/LLM أبداً.
- لا توجد شبكة هنا: هذا المكون خالص العرض. أي جلب خطوط خارجية إضافية يجب أن يمر عبر `font.ts` ويُوثَّق.

## معالجة الأخطاء

- `page == null` (لا صفحة نشطة في هذا الإطار) → `return null`، لا تعرض صفحة قديمة.
- توكن فارغ بعد `trim()` → `return null` لذلك التوكن فقط.
- `captions` فارغة → لا شيء يُعرض؛ المدة تسقط على `audioDurationSec` أو 3 ثوانٍ عبر `getShortDurationInFrames`. لا تخمن توقيتاً.
- تداخل/ترتيب زمني معكوس من TTS → اعتبر الصفحة حسب `startMs/durationMs` كما هي؛ إصلاح التوقيت مسؤولية `ai-voice-tts` لا هذا المكون.

## الاختبار

- شغّل `bun test` (العدّاء الرسمي للمستودع — لا `npm test` بأي عدّاء آخر).
- غطِّ: تحويل ثوانٍ→ميلي-ثانية، انقسام الصفحات عند `combineMs`، اتجاه الكاريوكي RTL/LTR، عدم فيض سطر طويل (اختبار `fitText` بحدود العرض)، `getShortDurationInFrames` مع كابشن فارغ.
- لا تدّعِ أن اختباراً نجح دون تشغيله. سجّل عدد الاختبارات الناجحة الفعلي.

## معايير القبول

- العربية تُعرض RTL دون كسر ترتيب الكلمات، والمختلط عربي-إنجليزي لا يعكس الجملة.
- التزامن بصري مع الصوت (الكلمة النشطة = الكلمة المنطوقة) عبر كل الثيمات الخمسة.
- لا فيض خارج 1080px للكلمات الطويلة والجمل متعددة الأسطر.
- الـ preview (`@remotion/player`) يطابق الـ render (لا قياس DOM لكل إطار، لا خطوط غير محمّلة).

## التوثيق المطلوب

- أي نمط جديد: سطر في جدول الأنماط أعلى `WordCaptions.tsx` + تحديث `CAPTION_STYLE_LABELS` + مثال إطار في PR.
- أي تغيير لثوابت التخطيط: اذكر السبب والقيم القديمة/الجديدة في وصف التغيير.

## القيود والممنوعات

- ممنوع إضافة اعتماد خط جديد دون وزن عربي حقيقي (كثير من خطوط اللاتينية تكسر التشكيل).
- ممنوع تغيير `SHORT_SAFE_BOTTOM` أو الهوامش لإصلاح فيض واحد — أصلح القياس (`fitText`/الاحتياطي) بدل تحريك المنطقة الآمنة.
- ممنوع نسخ منطق النافذة اليدوية القديم (`WINDOW_SIZE`) — صفحات TikTok هي المعيار الحالي.
