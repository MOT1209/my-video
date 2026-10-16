/**
 * أدوات مسار التصيير التفاعلي (SSE): شكل الرسائل وتشفيرها.
 * منطق الـ sandbox نفسه انتقل إلى `src/lib/render-runner.ts` ليتشاركه
 * المسار التفاعلي ومهمة إعادة المحاولة من الطابور.
 */

export type RenderProgress =
  | { type: "phase"; phase: string; progress: number; subtitle?: string }
  | {
      type: "done";
      url: string;
      size: number;
      /** true إذا أعاد الرابط من كاش ناتج التصيير */
      cached?: boolean;
      metrics?: {
        sandboxWallSeconds: number;
        estimatedCostUsd: number;
      };
      /** رصيد الكريدت المتبقي بعد العملية (null إن كانت الفوترة معطّلة) */
      credits?: number | null;
    }
  | { type: "error"; message: string };

export type OnProgressFn = (message: RenderProgress) => Promise<void>;

export function formatSSE(message: RenderProgress): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}
