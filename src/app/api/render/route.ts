import { waitUntil } from "@vercel/functions";
import { COMP_NAME, CompositionProps } from "../../../../types/constants";
import { AnyRenderRequest } from "../../../../types/schema";
import { SHORT_COMP_NAME, ShortProps } from "../../../../types/shorts";
import {
  databaseNotConfiguredResponse,
  getRequestUser,
  unauthorizedResponse,
} from "../../../lib/auth";
import { isDatabaseConfigured } from "../../../lib/db/client";
import { apiError } from "../../../helpers/api-response";
import { openBillingSession } from "../../../lib/billing-session";
import { RENDER_CREDIT_COST } from "../../../lib/credits";
import { findCachedRender, renderCachePath } from "../../../lib/render-cache";
import { friendlyRenderError } from "../../../lib/render-errors";
import {
  estimateRenderCostUsd,
  logRenderMetrics,
} from "../../../lib/render-metrics";
import {
  isProductionRuntime,
  runRenderOnce,
  runtimeVcpus,
} from "../../../lib/render-runner";
import {
  acquireRenderLock,
  releaseRenderLock,
  RENDER_LOCK_RETRY_SEC,
} from "../../../lib/render-lock";
import {
  checkRateLimit,
  clientIp,
  rateLimitUnavailableResponse,
  rateLimitedResponse,
} from "../../../lib/rate-limit";
import { formatSSE, type RenderProgress } from "./helpers";

/**
 * مسار التصيير — SSE تفاعلي.
 *
 * الطبقات فوقه بالترتيب، وكله **قبل** إنشاء أي sandbox:
 * 1) مصادقة (عند تفعيل Clerk): غير المسجّل يُرفض 401.
 * 2) حد معدل: 5 تصييرات/ساعة لكل موضوع (مستخدم مصادَق، وإلا IP).
 * 3) قفل موزّع: تصيير واحد نشط لكل موضوع عبر كل النسخ.
 * 4) كاش: نفس التكوين = رابط جاهز بلا كلفة.
 * 5) كريدت: يُخصم **بعد** التأكد من غياب الكاش (الكاش ليس تصييراً)،
 *    ويُرجَع تلقائياً إذا فشل التصيير.
 */
export async function POST(req: Request) {
  // 1) الهوية أولاً — أرخص رفض، وقبل أي عمل مكلف
  const requestUser = await getRequestUser();
  if (!requestUser) {
    return unauthorizedResponse();
  }
  if (process.env.NODE_ENV === "production" && !isDatabaseConfigured()) {
    return databaseNotConfiguredResponse();
  }

  const ip = clientIp(req);
  /** التصيير يُعزل بالمستخدم المصادَق؛ التطوير المحلي يبقى معزولاً حسب IP. */
  const subject = requestUser.authenticated
    ? `user:${requestUser.clerkId}`
    : `ip:${ip}`;

  // 2) التصيير مكلف (دقائق sandbox): 5 عمليات لكل موضوع كل ساعة.
  const verdict = await checkRateLimit(
    `render:${subject}`,
    5,
    60 * 60 * 1000,
  );
  if (verdict.unavailable) {
    return rateLimitUnavailableResponse();
  }
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict.retryAfterSec);
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return apiError("التصيير غير متاح: مخزن الفيديو غير مهيأ على الخادم.", 503);
  }

  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return apiError("أرسل الطلب بصيغة application/json.", 415);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError("تعذّر قراءة JSON صالح.", 400);
  }

  const parsedBody = AnyRenderRequest.safeParse(payload);
  if (!parsedBody.success) {
    return apiError("بيانات التصيير غير صالحة.", 400);
  }
  const body = parsedBody.data;

  // تحقق من inputProps حسب التكوين المطلوب (MyComp القديم أو ShortsComp الجديد)
  let compositionId: string;
  let inputProps: unknown;
  if (body.id === SHORT_COMP_NAME) {
    const parsedProps = ShortProps.safeParse(body.inputProps);
    if (!parsedProps.success) {
      return apiError("بيانات الفيديو غير صالحة.", 400);
    }
    compositionId = SHORT_COMP_NAME;
    inputProps = parsedProps.data;
  } else if (body.id === COMP_NAME) {
    const parsedProps = CompositionProps.safeParse(body.inputProps);
    if (!parsedProps.success) {
      return apiError("بيانات الفيديو غير صالحة.", 400);
    }
    compositionId = COMP_NAME;
    inputProps = parsedProps.data;
  } else {
    return apiError("نوع الفيديو غير معروف.", 400);
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  /** قفل موزّع: موضوع واحد = تصيير واحد نشط في كل نسخ الخادم. */
  const lockKey = `render-lock:${subject}`;
  let lockOwner: string | null;
  try {
    lockOwner = await acquireRenderLock(lockKey);
  } catch (err) {
    console.error("render: تعذّر التحقق من قفل التصيير", err instanceof Error ? err.name : "unknown");
    return apiError("التصيير غير متاح مؤقتاً: تعذّر التحقق من القفل.", 503);
  }
  if (!lockOwner) {
    return rateLimitedResponse(
      RENDER_LOCK_RETRY_SEC,
      "لديك عملية تصيير جارية حالياً — انتظر انتهاءها أولاً.",
    );
  }

  /** مفتاح حتمي لناتج التصيير: نفس التكوين = نفس الفيديو = رابط جاهز. */
  const cachePath = renderCachePath(
    compositionId,
    inputProps,
    requestUser.authenticated ? requestUser.clerkId : undefined,
  );
  const isProd = isProductionRuntime();
  const vcpus = runtimeVcpus(isProd);
  /** جلسة sandbox واحدة لكل موضوع — تُعاد بين طلباته المتتالية. */
  const sessionKey = `render-sandbox:${subject}`;
  const inputPropsRecord = inputProps as Record<string, unknown>;

  /** جلسة الفوترة: null يعني «الكريدت غير مفروض» (لا DATABASE_URL). */
  const billing = await openBillingSession(requestUser);
  if (process.env.NODE_ENV === "production" && !billing) {
    await releaseRenderLock(lockKey, lockOwner).catch((err: unknown) => {
      console.error("render: تعذّر تحرير القفل بعد فشل قاعدة البيانات", err instanceof Error ? err.name : "unknown");
    });
    return databaseNotConfiguredResponse();
  }

  const send = async (message: RenderProgress): Promise<void> => {
    await writer.write(encoder.encode(formatSSE(message))).catch(() => {});
  };

  const currentCredits = async (): Promise<number | null> =>
    billing ? await billing.balance() : null;

  /** تسجيل مقاييس عملية ناجحة (كاش أو تصيير) وإرجاع أرقامها للعميل. */
  const reportSuccess = (
    sandboxWallSeconds: number,
    size: number,
    cached: boolean,
  ) => {
    const estimatedCostUsd = estimateRenderCostUsd({
      sandboxWallSeconds,
      vcpus,
      blobBytes: size,
    });
    logRenderMetrics({
      compositionId,
      cachePath,
      cached,
      sandboxWallSeconds,
      vcpus,
      blobBytes: size,
      estimatedCostUsd,
    });
    return {
      sandboxWallSeconds,
      estimatedCostUsd: Number(estimatedCostUsd.totalUsd.toFixed(5)),
    };
  };

  /** تسجيل مقاييس عملية فاشلة — خسارة الـ sandbox يجب ألا تُختفي من الحساب. */
  const reportFailure = (elapsedSeconds: number) => {
    if (elapsedSeconds > 3) {
      logRenderMetrics({
        compositionId,
        cachePath,
        cached: false,
        sandboxWallSeconds: elapsedSeconds,
        vcpus,
        blobBytes: 0,
        estimatedCostUsd: estimateRenderCostUsd({
          sandboxWallSeconds: elapsedSeconds,
          vcpus,
          blobBytes: 0,
        }),
      });
    }
  };

  const runRender = async () => {
    const startMs = Date.now();
    let renderId: string | null = null;
    try {
      // 4) الكاش أولاً — قبل أي sandbox: نتيجة سابقة = صفر تكلفة
      await send({ type: "phase", phase: "التحقق من الكاش...", progress: 0 });
      const cached = await findCachedRender(cachePath, blobToken);
      if (cached) {
        const metrics = reportSuccess(
          Math.round((Date.now() - startMs) / 1000),
          cached.size,
          true,
        );
        await send({
          type: "done",
          url: cached.url,
          size: cached.size,
          cached: true,
          metrics,
          credits: await currentCredits(),
        });
        return;
      }

      // 5) الكاش ليس تصييراً ⇒ الخصم الآن، قبل إنشاء أي مورد مدفوع
      if (billing) {
        const charged = await billing.charge();
        if (!charged.ok) {
          await send({
            type: "error",
            message: `رصيدك لا يكفي: التصيير يستهلك ${RENDER_CREDIT_COST} كريدت ولديك ${charged.credits}. أضف كريدت من لوحة الحساب ثم أعد المحاولة.`,
          });
          return;
        }
        renderId = await billing.startRender({
          compositionId,
          inputProps: inputPropsRecord,
          cacheKey: cachePath,
        });
        if (!renderId) {
          await billing.refund();
          throw new Error("render_record_unavailable");
        }
      }

      const outcome = await runRenderOnce({
        compositionId,
        inputProps: inputPropsRecord,
        blobPath: cachePath,
        blobToken,
        sessionKey,
        ownerId: requestUser.authenticated ? requestUser.clerkId : undefined,
        onProgress: (event) =>
          send({
            type: "phase",
            phase: event.phase,
            progress: event.progress,
            subtitle: event.subtitle,
          }),
      });

      const metrics = reportSuccess(
        outcome.sandboxWallSeconds,
        outcome.size,
        false,
      );
      if (billing) {
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
    } catch (err) {
      console.error("render: فشل تنفيذ التصيير", err instanceof Error ? err.name : "unknown");
      reportFailure(Math.round((Date.now() - startMs) / 1000));
      // Refund only a charged render; an SSE disconnect is swallowed by send().
      if (billing && renderId) {
        try {
          await billing.refund();
          await billing.finishRender(renderId, {
            status: "error",
            error: friendlyRenderError(err),
          });
        } catch (billingError) {
          console.error("render: تعذّر إكمال استرداد الرصيد", billingError instanceof Error ? billingError.name : "unknown");
        }
      }
      await send({ type: "error", message: friendlyRenderError(err) });
    } finally {
      // القفل يُستهلك فقط أثناء التصيير الفعلي — يُحرَّر دائماً هنا
      await releaseRenderLock(lockKey, lockOwner).catch((err: unknown) => {
        console.error("render: تعذّر تحرير قفل التصيير", err);
      });
      // إغلاق واحد آمن حتى مع عبارات return الداخلية أعلاه
      await writer.close().catch(() => {});
    }
  };

  waitUntil(runRender());

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
