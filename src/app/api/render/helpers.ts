import type { SSEMessage } from "../../../../types/schema";

/**
 * أدوات مسار التصيير التفاعلي (SSE): شكل الرسائل وتشفيرها.
 * منطق الـ sandbox نفسه انتقل إلى `src/lib/render-runner.ts` ليتشاركه
 * المسار التفاعلي ومهمة إعادة المحاولة من الطابور.
 */

/** نفس رسائل العميل (`SSEMessage`) — تعريف واحد في `types/schema.ts`. */
export type RenderProgress = SSEMessage;

export type OnProgressFn = (message: RenderProgress) => Promise<void>;

export function formatSSE(message: RenderProgress): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}
