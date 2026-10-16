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
        estimatedCostUsd: number;
      };
    }
  | { type: "error"; message: string };
