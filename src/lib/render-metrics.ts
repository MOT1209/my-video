/**
 * قياس $/video (المرحلة 3 من الخطة):
 * أسعار Vercel Sandbox لمنطقة iad1 الافتراضية حسب التسعير الرسمي
 * (vercel.com/docs/sandbox/pricing — تم التحقق في 2026-10).
 */
export const ACTIVE_CPU_USD_PER_VCPU_HOUR = 0.128;
export const MEMORY_USD_PER_GB_HOUR = 0.0212;
export const NETWORK_USD_PER_GB = 0.15;

/** كل vCPU يأتي مع 2 GB ذاكرة مُجزّأة. */
export const MEMORY_GB_PER_VCPU = 2;

/** عدة vCPUs المُخصصة لصورتك: مسار الـ snapshot الحقيقي. */
export const PROD_SANDBOX_VCPUS = 2;
/** مسار التطوير المحلي: القيمة الافتراضية لـ createSandbox في @remotion/vercel. */
export const DEV_SANDBOX_VCPUS = 4;

/**
 * عدد vCPUs الـ vCPU-Active لا يمكن قياسه من داخل الكود؛ نعتمد نسبة
 * استغلال افتراضية وسائطة (التصيير ثقيل على المعالج لكن ينتظر تحميل
 * الوسائط أحياناً). نُسجّل ثواني الجدار الفعلي دوماً، فيمكن معايرة
 * هذه النسبة لاحقاً بمطابقتها مع استهلاك Active CPU في لوحة Vercel.
 */
export const ASSUMED_ACTIVE_CPU_UTILIZATION = 0.6;

export interface RenderCostInput {
  /** ثواني التشغيل الفعلية للـ sandbox (من الإنشاء حتى إيقافه). */
  sandboxWallSeconds: number;
  vcpus: number;
  /** حجم الفيديو المرفوع بالبايت (يُحسب شبكة صادرة من الـ sandbox). */
  blobBytes: number;
}

export interface RenderCostBreakdown {
  activeCpuUsd: number;
  memoryUsd: number;
  networkUsd: number;
  totalUsd: number;
}

/** تقدير تكلفة تصيير واحد بالدولار، حسب أسعار Vercel Sandbox. */
export function estimateRenderCostUsd(input: RenderCostInput): RenderCostBreakdown {
  const hours = input.sandboxWallSeconds / 3600;
  const activeCpuUsd =
    input.vcpus * ACTIVE_CPU_USD_PER_VCPU_HOUR * ASSUMED_ACTIVE_CPU_UTILIZATION * hours;
  const memoryUsd =
    input.vcpus * MEMORY_GB_PER_VCPU * MEMORY_USD_PER_GB_HOUR * hours;
  const networkUsd = (input.blobBytes / 1024 ** 3) * NETWORK_USD_PER_GB;
  const totalUsd = activeCpuUsd + memoryUsd + networkUsd;
  return { activeCpuUsd, memoryUsd, networkUsd, totalUsd };
}

export interface RenderMetrics {
  compositionId: string;
  cachePath: string;
  /** true إذا أعاد السجل نتيجة من الكاش بلا sandbox. */
  cached: boolean;
  sandboxWallSeconds: number;
  vcpus: number;
  blobBytes: number;
  estimatedCostUsd: RenderCostBreakdown;
}

/**
 * تسجيل المقاييس كسطر JSON قابل للفرز داخل سجلات Vercel
 * (Structured Logs). ميّزنا الحدث بـ `event` لسهولة الفلترة والاستعلام.
 */
export function logRenderMetrics(metrics: RenderMetrics): void {
  console.log(JSON.stringify({ event: "render-metrics", ...metrics }));
}
