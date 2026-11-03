/**
 * جاهزية الإعداد: أي متغيرات بيئة ناقصة تعطّل ماذا؟
 *
 * أكثر ما يتعثر فيه نشر هذا التطبيق هو متغير بيئة غائب، وأثره صامت: تُغلق
 * المسارات المكلفة برد 503 أو تتعطل ميزة بلا خطأ واضح. هذا الفحص يجمع الحالة
 * في مكان واحد. يُرجع أسماء المتغيرات وحالتها فقط — لا قيماً أبداً.
 */

export interface ReadinessCheck {
  id: string;
  /** المتغيرات المطلوبة معاً (كلها مضبوطة ⇒ جاهز) */
  vars: string[];
  /** true = الإنتاج لا يعمل كاملاً بدونه؛ false = ميزة اختيارية تتعطل وحدها */
  required: boolean;
  ok: boolean;
  /** ما الذي يتعطل عند غيابه */
  impact: string;
}

const DEFINITIONS: Array<Omit<ReadinessCheck, "ok">> = [
  {
    id: "blob",
    vars: ["BLOB_READ_WRITE_TOKEN"],
    required: true,
    impact: "التصيير ورفع الصوت والخلفيات",
  },
  {
    id: "database",
    vars: ["DATABASE_URL"],
    required: true,
    impact: "الحسابات والكريدت وسجل التصييرات؛ التصيير مغلق في الإنتاج بدونها",
  },
  {
    id: "clerk",
    vars: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    required: true,
    impact: "تسجيل الدخول؛ المسارات المكلفة وميزات الحساب مغلقة في الإنتاج بدونها",
  },
  {
    id: "upstash",
    vars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    required: true,
    impact: "حد المعدل وقفل التصيير الموزّع؛ المسارات المكلفة مغلقة في الإنتاج بدونه",
  },
  {
    id: "stripe",
    vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    required: false,
    impact: "شراء الكريدت (المفتاح بلا سر الويب هوك يستقبل دفعاً لا يُسجَّل)",
  },
  {
    id: "cron",
    vars: ["CRON_SECRET"],
    required: false,
    impact: "حسم التصييرات المعلّقة وإعادة محاولة الفاشل",
  },
  {
    id: "gemini",
    vars: ["GEMINI_API_KEY"],
    required: false,
    impact: "اقتراح السكربت والخلفيات وتفريغ الصوت",
  },
  {
    id: "azure-speech",
    vars: ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"],
    required: false,
    impact: "البديل الرسمي للصوت (يبقى Edge-TTS)",
  },
  {
    id: "app-url",
    vars: ["APP_URL"],
    required: false,
    impact: "أصل روابط العودة من Stripe على نطاق مخصص (روابط Vercel تعمل بدونه)",
  },
];

export function checkReadiness(
  env: Record<string, string | undefined> = process.env,
): ReadinessCheck[] {
  return DEFINITIONS.map((definition) => ({
    ...definition,
    ok: definition.vars.every((name) => Boolean(env[name])),
  }));
}

/** هل كل المطلوب مضبوط؟ (الاختياري لا يؤثر) */
export function isReady(checks: ReadinessCheck[]): boolean {
  return checks.every((check) => check.ok || !check.required);
}
