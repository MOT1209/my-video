---
name: fish-drama3-tts
description: تعليق صوتي تمثيلي عربي عبر Fish Audio Drama 3 — توجيه الأداء بلغة طبيعية مع أصوات ووقفات ووسوم مزدوجة
version: 1.0.0
---

# Fish Audio Drama 3 — تعليق صوتي مُوجَّه التمثيل

حين يطلب المستخدم تعليقاً صوتياً **تمثيلياً** (مشاعر، همس، ضحك، حوار شخصيات) لمشاهد الفيديو العمودي، استخدم هذا الـ skill. الكود في هذا المجلد يتكفل بالطلبات، التوجيه، والحفظ المتزامن مع المشاهد.

المصدر: توثيق Fish Audio الرسمي — [Drama 3](https://docs.fish.audio/features/text-to-speech/drama-3) — [مرجع API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)

## متى تستخدمه ومتى لا

- **استخدمه**: المستخدم يريد أداءً (حزين/متحمس/هامس/ساخر)، أصواتاً ([sigh]/[laugh]/[pause])، تمييز كلمات محددة، أو حواراً متعدد الشخصيات.
- **لا تستخدمه**: تعليق محايد سريع ورخيص — استخدم Edge-TTS المجاني (`src/lib/tts.ts`) أو Groq (`url-groq-video-generator`) بدلاً منه. Drama 3 مدفوع (يستهلك رصيد Fish Audio) وهو في مرحلة Preview.

## خط الأنابيب

### 1. الصوت المفرد الموجَّه (`fish-drama3.ts`)

```ts
import { synthesizeDrama3, addDirection, wrapPairedTag } from "./index";

// توجيه كامل الجملة
const audio = await synthesizeDrama3("[بصوت مكسور يكتم البكاء] أنا بخير. فعلاً. اذهب بدوني.");

// تمييز كلمات محددة فقط
const directed = "أنا بخير. فعلاً. " + wrapPairedTag("اذهب بدوني", "whisper");
const audio2 = await synthesizeDrama3(directed);
```

- الـ endpoint: `POST https://api.fish.audio/v1/tts`
- **الترويسة `model: drama-3` إلزامية وحرفية** — الكود يرسلها دائماً. أي خطأ إملائي يُسقط الطلب **بصمت** على `s2.1-pro` (تحذير رسمي من التوثيق)، فلا تبنِ الترويسة يدوياً أبداً.
- `reference_id`: صوت من مكتبة Fish Audio أو صوت مستنسخ. اتركه فارغاً للصوت الافتراضي. أصوات أمثلة التوثيق (إنجليزية): Sheila ‏`f3a2b90078d54a65af4b95f63bc7798e`، ‏Adrian ‏`bf322df2096a46f18c579d0baa36f41d`، ‏Delia ‏`c70cfb98867a4bfb9ae20d2401257b92`.
- الصيغة الافتراضية `mp3`؛ `format: "wav"` للجودة القصوى.

### 2. صوت كل المشاهد متزامناً (`synthesizeScenesAudio`)

```ts
import { synthesizeScenesAudio } from "./index";

const audio = await synthesizeScenesAudio(summary.scenes, {
  referenceId: "YOUR_ARABIC_VOICE_ID",  // أو null للافتراضي
  direction: "بصوت دافئ واثق كراوٍ محترف",  // يُحقن في كل مشهد — أو مصفوفة لكل مشهد
  format: "mp3",
});
// audio.scenes[i].filePath → ملف المشهد i: <tmp>/fish-drama3/<hash>/s1.mp3...
// audio.manifestPath → manifest.json (المشهد → الملف + النص الموجَّه)
```

- كل مشهد (≤ 280 حرف) = طلب واحد. المشهد الذي يتجاوز الحد بعد التوجيه **يُرفض بخطأ صريح** — قصّره بدل تقسيم الصوت.
- **لا دمج تلقائي**: ملفات mp3 لا تُدمج بترابط آمن بدون ffmpeg. اقرأ `manifest.json` ورتّب المشاهد عند التركيب.
- الأصوات العربية: اختر صوتاً عربياً من [مكتبة الأصوات](https://fish.audio) أو استنسخ صوتاً — أصوات العرض في التوثيق إنجليزية فقط.

### 3. الحوار متعدد المتحدثين (`buildDialogue`)

```ts
import { buildDialogue, synthesizeDrama3 } from "./index";

const text = buildDialogue([
  { speaker: 0, text: "كنت هناك تلك الليلة.", direction: "نبرة اتهام هادئة خطيرة" },
  { speaker: 1, text: "كنت في البيت. نائماً.", direction: "دفاعي بتوتر خفيف" },
]);
const audio = await synthesizeDrama3(text, {
  referenceId: ["VOICE_ID_0", "VOICE_ID_1"],  // فهرس الصوت = رقم <|speaker:N|>
});
```

المشهد كاملاً يُولَّد في **طلب واحد**. التوجيهات والوسوم المزدوجة تعمل داخل كل منعطف.

## قواعد التوجيه الخمس (من التوثيق — امزجها بحرية في نفس السطر)

| القاعدة | الصيغة | مثال |
|---|---|---|
| وصف الأداء بكلماتك (عربي أو إنجليزي) | `[التوجيه] النص` | `[barely holding it together] I'm fine` / `[بصوت مكسور] أنا بخير` |
| صوت/شعور/وقفة في موضعه | `[sigh]` `[laugh]` `[pause]` `[shaky breath]` وسط النص | `طيب، [sigh] لنحاول مجدداً` |
| تمييز كلمات محددة | `<whisper>…</whisper>` | `<emphasis>` `<soft>` `<fast>` `<slow>` `<stress>` `<forceful>` |
| تبديل اللغة (تجريبي) | `<french>…</french>` | `<spanish>` `<german>` `<chinese>` — الدقة متفاوتة حسب الصوت |
| تثبيت النطق | `<\|phoneme_start\|>…<\|phoneme_end\|>` | إنجليزي: Arpabet ‏(`EH1`) — صيني: pinyin — ياباني: romaji |

الدوال `addDirection()` و`wrapPairedTag()` و`buildDialogue()` تبني هذه الصيغ — استخدمها بدل كتابة الوسوم يدوياً.

## المتطلبات

- `FISH_AUDIO_API_KEY` في البيئة (`.env.local` — لا يلتزم في git أبداً). احصل على مفتاح من [fish.audio](https://fish.audio) ← API Keys.
- لا اعتماديات جديدة — `fetch` الأصلي فقط.

## ملاحظات للوكيل

- إعادة المحاولة 3 مرات بتراجع أسّي لأخطاء 429/5xx/503 والشبكة — **لا تعيد** 401 (مفتاح خطأ) و402 (رصيد نفد): اعرض رسالة واضحة للمستخدم.
- Drama 3 في **Preview**: النتائج متفاوتة بين المحاولات — ولّد 2–3 محاولات واختر الأفضل للمقاطع الحساسة.
- Fish Audio لا يرجع حدود كلمات — للكابشن استخدم `distributeCaptionsEvenly(narrationText, durationSec)` من `types/shorts.ts` (احسب المدة من ملف الصوت).
- التوجيهات جزء من النص المُحاسَب — أبقِ المشهد + توجيهه ضمن الحد.
- للعربية الفصحى/العامية: التوجيه نفسه يمكن كتابته بالعربية — الأداء يتبع التوجيه أياً كانت لغته.
