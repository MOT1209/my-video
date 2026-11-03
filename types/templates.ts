import {
  DEFAULT_AR_VOICE,
  DEFAULT_EN_VOICE,
  type CaptionStyle,
  type ShortTheme,
} from "./shorts";

/**
 * قوالب جاهزة للمحرّر: خطاف + مشاهد + خاتمة دعوة لإجراء (CTA) مع الثيم
 * وأسلوب الكابشن والصوت المناسبة لها. القالب بيانات فقط — يملأ نص المحرّر
 * وإعداداته، ثم يعدّل المستخدم ما يشاء قبل توليد الصوت والتصيير.
 *
 * حدود المحتوى (خطاف ≤ 120 حرفاً، مشاهد ≤ 12، ونص التعليق الكامل ضمن حد TTS)
 * مفروضة باختبار في `templates.test.ts`، فلا يخرج قالب لا يمكن تصييره.
 */
export interface ShortTemplate {
  id: string;
  label: string;
  description: string;
  lang: "ar" | "en";
  hook: string;
  /** مشهد لكل عنصر؛ آخرها دعوة الإجراء */
  scenes: string[];
  theme: ShortTheme;
  captionStyle: CaptionStyle;
  voiceId: string;
}

export const SHORT_TEMPLATES: readonly ShortTemplate[] = [
  {
    id: "ar-facts",
    label: "حقائق مدهشة",
    description: "ثلاث حقائق قصيرة تنتهي بسؤال يستفز التعليقات",
    lang: "ar",
    hook: "ثلاث حقائق لن تصدق أنك لم تعرفها",
    scenes: [
      "الحقيقة الأولى: اكتب هنا معلومة مدهشة وقصيرة",
      "الحقيقة الثانية: معلومة تفاجئ المشاهد",
      "الحقيقة الثالثة: معلومة تختم بها بقوة",
      "أي حقيقة فاجأتك أكثر؟ اكتبها في التعليقات",
    ],
    theme: "dark",
    captionStyle: "pop",
    voiceId: DEFAULT_AR_VOICE,
  },
  {
    id: "ar-tip",
    label: "نصيحة اليوم",
    description: "مشكلة فحل بخطوة واحدة، ثم دعوة للمتابعة",
    lang: "ar",
    hook: "خطأ صغير يضيّع وقتك كل يوم",
    scenes: [
      "المشكلة: صِف الخطأ الشائع في جملة واحدة",
      "السبب: لماذا يقع الناس فيه",
      "الحل: خطوة واحدة بسيطة يبدأ بها المشاهد اليوم",
      "تابعنا لنصيحة جديدة كل يوم",
    ],
    theme: "paper",
    captionStyle: "slide-up",
    voiceId: DEFAULT_AR_VOICE,
  },
  {
    id: "ar-quote",
    label: "اقتباس ملهم",
    description: "اقتباس واحد مع تأمل قصير وخاتمة هادئة",
    lang: "ar",
    hook: "جملة واحدة قد تغيّر يومك",
    scenes: [
      "اكتب هنا الاقتباس كما هو بين علامتين",
      "ما معناه في جملة واحدة",
      "كيف تطبقه اليوم في موقف حقيقي",
      "احفظ الفيديو وأعد مشاهدته عندما تحتاجه",
    ],
    theme: "quotes",
    captionStyle: "glow",
    voiceId: DEFAULT_AR_VOICE,
  },
  {
    id: "ar-news",
    label: "خبر سريع",
    description: "الخبر، السياق، ما يعنيه لك، ثم المتابعة",
    lang: "ar",
    hook: "خبر عاجل يهمك معرفته الآن",
    scenes: [
      "الخبر: ماذا حدث في جملة واحدة",
      "السياق: لماذا هذا مهم الآن",
      "ماذا يعني لك كمشاهد",
      "تابعنا ليصلك كل جديد أولاً بأول",
    ],
    theme: "news",
    captionStyle: "karaoke",
    voiceId: DEFAULT_AR_VOICE,
  },
  {
    id: "en-facts",
    label: "Did you know?",
    description: "Three surprising facts and a comment prompt",
    lang: "en",
    hook: "Three facts you will not believe",
    scenes: [
      "Fact one: write a short, surprising fact here",
      "Fact two: something that catches the viewer off guard",
      "Fact three: finish strong",
      "Which one surprised you most? Tell us in the comments",
    ],
    theme: "neon",
    captionStyle: "pop",
    voiceId: DEFAULT_EN_VOICE,
  },
  {
    id: "en-tip",
    label: "Quick tip",
    description: "Problem, fix, and a follow call to action",
    lang: "en",
    hook: "Stop making this one mistake",
    scenes: [
      "The mistake: describe it in a single sentence",
      "Why it happens and what it costs you",
      "The fix: one small step to start today",
      "Follow for a new tip every day",
    ],
    theme: "dark",
    captionStyle: "slide-up",
    voiceId: DEFAULT_EN_VOICE,
  },
] as const;

export function findTemplate(id: string): ShortTemplate | undefined {
  return SHORT_TEMPLATES.find((template) => template.id === id);
}
