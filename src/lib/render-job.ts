import type { RenderProgress } from "../app/api/render/helpers";
import type { BillingSession } from "./billing-session";
import { RENDER_CREDIT_COST } from "./credits";
import { friendlyRenderError } from "./render-errors";
import type { ProgressReporter, RunRenderOutcome } from "./render-runner";

/**
 * دورة حياة تصيير تفاعلي واحد بعد اجتياز الحرّاس (هوية، حد، تحقق، قفل):
 * كاش ← خصم ذرّي + صف ← تصيير ← إغلاق الصف، أو إرجاع ثم إغلاق فاشل.
 *
 * مفصولة عن مسار Next كي تُختبر مسارات الفشل كلها (رفع فاشل، انقطاع
 * العميل، فشل الكتابة بعد الرفع...) على Postgres حقيقي بلا mock.module
 * (الذي يتسرّب بين ملفات الاختبار في bun).
 */

/** أقصى حجم لجسم طلب التصيير — ShortProps بحدودها القصوى أصغر من هذا بكثير. */
export const MAX_RENDER_BODY_BYTES = 256 * 1024;

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 };

/**
 * يقرأ جسم JSON بحد حجم صريح: الترويسة المعلنة أولاً (رفض قبل القراءة)،
 * ثم الطول الفعلي (الترويسة قد تغيب مع chunked). JSON تالف ⇒ 400.
 */
export async function readJsonBody(
  req: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) {
    return { ok: false, status: 413 };
  }
  const raw = await req.text().catch(() => null);
  if (raw === null) {
    return { ok: false, status: 400 };
  }
  if (new TextEncoder().encode(raw).length > maxBytes) {
    return { ok: false, status: 413 };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400 };
  }
}

export interface RenderJobOptions {
  compositionId: string;
  inputProps: Record<string, unknown>;
  cachePath: string;
  /** null = الكريدت غير مفروض (تطوير محلي أو فتح صريح فقط). */
  billing: BillingSession | null;
  /** إرسال رسالة SSE — يجب ألا يرمي (انقطاع العميل يُبتلع عند المستدعي). */
  send: (message: RenderProgress) => Promise<void>;
  findCached: (cachePath: string) => Promise<{ url: string; size: number } | null>;
  render: (onProgress: ProgressReporter) => Promise<RunRenderOutcome>;
  /** مقاييس النجاح (كاش أو تصيير) — تُعاد أرقامها للعميل. */
  reportSuccess?: (
    sandboxWallSeconds: number,
    size: number,
    cached: boolean,
  ) => { sandboxWallSeconds: number; estimatedCostUsd: number } | undefined;
  reportFailure?: (elapsedSeconds: number) => void;
  now?: () => number;
}

export type RenderJobResult =
  | { status: "cached" | "rendered"; url: string }
  | { status: "insufficient" | "duplicate" }
  | { status: "failed"; refunded: boolean };

export async function executeRenderJob(
  options: RenderJobOptions,
): Promise<RenderJobResult> {
  const { billing, send } = options;
  const now = options.now ?? Date.now;
  const startMs = now();
  const elapsed = () => Math.round((now() - startMs) / 1000);
  const currentCredits = async (): Promise<number | null> =>
    billing ? await billing.balance() : null;

  let renderId: string | null = null;
  try {
    // الكاش أولاً — قبل أي sandbox أو خصم: نتيجة سابقة = صفر تكلفة
    await send({ type: "phase", phase: "التحقق من الكاش...", progress: 0 });
    const cached = await options.findCached(options.cachePath);
    if (cached) {
      await send({
        type: "done",
        url: cached.url,
        size: cached.size,
        cached: true,
        metrics: options.reportSuccess?.(elapsed(), cached.size, true),
        credits: await currentCredits(),
      });
      return { status: "cached", url: cached.url };
    }

    // الكاش ليس تصييراً ⇒ الخصم وفتح الصف الآن (ذرّياً)، قبل أي مورد مدفوع
    if (billing) {
      const started = await billing.startPaidRender({
        compositionId: options.compositionId,
        inputProps: options.inputProps,
        cacheKey: options.cachePath,
      });
      if (started.status === "insufficient") {
        await send({
          type: "error",
          message: `رصيدك لا يكفي: التصيير يستهلك ${RENDER_CREDIT_COST} كريدت ولديك ${started.credits}. أضف كريدت من لوحة الحساب ثم أعد المحاولة.`,
        });
        return { status: "insufficient" };
      }
      if (started.status === "duplicate") {
        await send({
          type: "error",
          message: "هذا الفيديو قيد التصيير بالفعل — انتظر انتهاءه ثم أعد المحاولة.",
        });
        return { status: "duplicate" };
      }
      renderId = started.renderId;
    }

    const outcome = await options.render((event) =>
      send({
        type: "phase",
        phase: event.phase,
        progress: event.progress,
        subtitle: event.subtitle,
      }),
    );

    // الناتج مرفوع الآن: من هنا لا إرجاع أبداً. إن فشلت كتابة `done`
    // يبقى الصف running ويحسمه الطابور ناجحاً من الكاش.
    const metrics = options.reportSuccess?.(
      outcome.sandboxWallSeconds,
      outcome.size,
      false,
    );
    if (billing && renderId) {
      await billing.finishRender(renderId, {
        status: "done",
        url: outcome.url,
        sizeBytes: outcome.size,
        sandboxMs: outcome.sandboxWallSeconds * 1000,
      });
    }
    await send({
      type: "done",
      url: outcome.url,
      size: outcome.size,
      cached: false,
      metrics,
      credits: await currentCredits(),
    });
    return { status: "rendered", url: outcome.url };
  } catch (err) {
    console.error("render: فشل التصيير", (err as Error)?.message);
    options.reportFailure?.(elapsed());
    // الإرجاع أولاً ثم الإغلاق فاشلاً. إن تعذّر الإرجاع نترك الصف running
    // فيحسمه الطابور (فحص الكاش ثم إرجاع مرة واحدة).
    let refunded = false;
    if (billing && renderId) {
      refunded = await billing.refund(renderId);
      if (refunded) {
        await billing.finishRender(renderId, {
          status: "error",
          error: friendlyRenderError(err),
        });
      }
    }
    await send({ type: "error", message: friendlyRenderError(err) });
    return { status: "failed", refunded };
  }
}
