# Remotion — Project Extension for my-video (Shorts 9:16)

> ملحق خاص بالمشروع فوق الـ skill الأصلية (`SKILL.md` مُقفلة عبر `skills-lock.json` من `remotion-dev/skills` — لا تعدّلها).
> الوكيل: اقرأ `SKILL.md` الأصلية أولاً للأنماط العامة، ثم طبّق قيود هذا المشروع أدناه.

## التركيبة القائمة (لا تكسرها)

- `src/remotion/Root.tsx`: تركيبتان — `ShortsComp` (المنتج: 1080×1920، 30fps، مدة محسوبة عبر `calculateMetadata` + `getShortDurationInFrames`) و`MyComp` القديمة (اتركها حتى إزالة معتمدة).
- `ShortMain.tsx`: طبقات `Background → HookTitle (أول 75 إطاراً = 2.5s) → SceneCard → WordCaptions → Audio` + `ShortProgress`.
- الإصدار المقفل: Remotion `4.0.535` لكل الحزم (`@remotion/captions` و`layout-utils` بنفس النسخة — راجع `package.json`).

## قواعد ملزمة لهذا المشروع

1. **الحتمية الإطارية**: نفس `props + frame + fps` = نفس البكسل. ممنوع `Math.random`/`Date.now()` داخل أي مكون Remotion.
2. **المدة**: تُشتق من `max(آخر كلمة، مدة الصوت، 3s) + ذيل 1s` مسقوفة بـ 60s (`types/shorts.ts`). لا مدة ثابتة لـ `ShortsComp` في `Root.tsx` — `calculateMetadata` هي المصدر.
3. **الحقول الجديدة اختيارية دائماً**: أي prop جديد في `ShortProps` يحمل `.default()` (نمط `captionStyle`/`backgroundMedia`) حتى لا تنكسر طلبات `/api/render` القديمة.
4. **الأداء**: `fitText` مرة/صفحة في `useMemo`؛ لا قياس DOM لكل إطار. الحركات `spring(damping:200)` للدخول + `interpolate` للخروج (نمط `WordCaptions.tsx`).
5. **التوافق preview/render**: ما يُرى في `@remotion/player` يجب أن يطابق الـ render — أي خط/قياس جديد يُختبر في المسارين.
6. **حالات الغياب**: `audioUrl=null` → بلا `<Audio>`؛ `media=null` → ثيم CSS؛ `captions=[]` → مدة من الصوت. لا شاشة فارغة أبداً.

## الأنماط المدعومة / الممنوعة

- مدعوم: `Sequence` لكل صفحة كابشن، `AbsoluteFill` للطبقات، `Img`/`OffthreadVideo` للوسائط، `Audio` للصوت/الموسيقى.
- ممنوع: `<img>`/`<video>` الخام داخل التركيبات، جلب شبكة داخل المكون، خطوط غير محمّلة في `font.ts` (NotoKufiArabic عربي+لاتيني 400/700).

## فحص ما قبل التغيير

- `npx tsc --noEmit` نظيف، `bun test` أخضر، و`ShortsComp` تُعرض في Studio دون أخطاء وحدة مفقودة.
- أي تغيير يكسر `MyComp` القديمة يُذكر صراحة في وصف التغيير (لا حذف صامت).

## صلة المهارات

- كابشن → `kinetic-captions/SKILL.md` | خلفيات → `cinematic-media/SKILL.md` | صوت → `ai-voice-tts/SKILL.md` | أداء render → `rendering-performance/SKILL.md`.
