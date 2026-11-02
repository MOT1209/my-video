import { z } from "zod";
import { CompositionProps } from "./constants";
import { SHORT_COMP_NAME, ShortProps } from "./shorts";

export const RenderRequest = z.object({
  id: z.string(),
  inputProps: CompositionProps,
});

/** طلب render عام: MyComp القديم أو ShortsComp الجديد */
export const AnyRenderRequest = z.object({
  id: z.string(),
  inputProps: z.unknown(),
});

export const ShortRenderRequest = z.object({
  id: z.literal(SHORT_COMP_NAME),
  inputProps: ShortProps,
});

export type RenderResponse =
  | {
      type: "error";
      message: string;
    }
  | {
      type: "done";
      url: string;
      size: number;
    };

/**
 * رسائل SSE لمسار التصيير — تعريف واحد يشترك فيه الخادم (`/api/render`)
 * والعميل (`useRendering`)، حتى لا يتباعد الشكلان.
 */
export type SSEMessage =
  | { type: "phase"; phase: string; progress: number; subtitle?: string }
  | {
      type: "done";
      url: string;
      size: number;
      /** true إذا أعاد الرابط من كاش ناتج التصيير */
      cached?: boolean;
      metrics?: {
        sandboxWallSeconds: number;
        /** يُرسل خارج الإنتاج فقط: كلفة البنية تفصيل داخلي لا يخص العميل */
        estimatedCostUsd?: number;
      };
      /** رصيد الكريدت المتبقي بعد العملية (null إن كانت الفوترة معطّلة) */
      credits?: number | null;
    }
  | { type: "error"; message: string };
