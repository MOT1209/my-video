import {
  addBundleToSandbox,
  createSandbox,
  renderMediaOnVercel,
  uploadToVercelBlob,
  type VercelSandbox,
} from "@remotion/vercel";
import { BlobAccessError } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
import { COMP_NAME, CompositionProps } from "../../../../types/constants";
import { AnyRenderRequest } from "../../../../types/schema";
import { SHORT_COMP_NAME, ShortProps } from "../../../../types/shorts";
import { findCachedRender, renderCachePath } from "../../../lib/render-cache";
import {
  DEV_SANDBOX_VCPUS,
  estimateRenderCostUsd,
  logRenderMetrics,
  PROD_SANDBOX_VCPUS,
} from "../../../lib/render-metrics";
import {
  checkRateLimit,
  clientIp,
  rateLimitedResponse,
} from "../../../lib/rate-limit";
import {
  acquireRenderLock,
  releaseRenderLock,
  RENDER_LOCK_RETRY_SEC,
} from "../../../lib/render-lock";
import {
  acquireSessionSandbox,
  dropSessionSandbox,
  holdSessionSandbox,
  SANDBOX_IDLE_STOP_MS,
} from "../../../lib/sandbox-session";
import {
  bundleRemotionProject,
  formatSSE,
  type RenderProgress,
} from "./helpers";
import { restoreSnapshot } from "./restore-snapshot";

/** يترجم خطأ مخزن Blob الخاص إلى رسالة عربية واضحة. */
function friendlyRenderError(err: unknown): string {
  const message = (err as Error)?.message ?? String(err);
  if (
    err instanceof BlobAccessError ||
    message.includes("public access on a private store")
  ) {
    return "مخزن Blob خاص (private) والتطبيق يحتاج رفعاً عاماً. من Vercel Dashboard افتح Storage ثم إعدادات الـ Blob store واسمح بالوصول العام ثم أعد النشر.";
  }
  return message;
}

/** هل الخطأ يشير إلى sandbox توقف/انتهى (فقط حينها تستفيد إعادة المحاولة)؟ */
function isStoppedSandboxError(err: unknown): boolean {
  const message = (err as Error)?.message ?? String(err);
  return (
    message.includes("sandbox_stopped") ||
    message.includes("sandbox stopped") ||
    message.includes("expired")
  );
}

export async function POST(req: Request) {
  // التصيير مكلف (دقائق sandbox): 5 عمليات لكل IP كل ساعة.
  const verdict = await checkRateLimit(`render:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict.retryAfterSec);
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. To fix this, go to vercel.com, log in, select Storage, click "Create Database", select "Blob", link it to your project, then add BLOB_READ_WRITE_TOKEN to your .env file.',
    );
  }

  const payload = await req.json();
  const body = AnyRenderRequest.parse(payload);

  // تحقق من inputProps حسب التكوين المطلوب (MyComp القديم أو ShortsComp الجديد)
  let compositionId: string;
  let inputProps: unknown;
  if (body.id === SHORT_COMP_NAME) {
    compositionId = SHORT_COMP_NAME;
    inputProps = ShortProps.parse(body.inputProps);
  } else if (body.id === COMP_NAME) {
    compositionId = COMP_NAME;
    inputProps = CompositionProps.parse(body.inputProps);
  } else {
    throw new Error(`Unknown composition id: ${body.id}`);
  }

  const ip = clientIp(req);
  /** قفل موزّع: مستخدُم واحد = تصيير واحد نشط في كل نسخ الخادم. */
  const lockKey = `render-lock:${ip}`;
  if (!(await acquireRenderLock(lockKey))) {
    return rateLimitedResponse(
      RENDER_LOCK_RETRY_SEC,
      "لديك عملية تصيير جارية حالياً — انتظر انتهاءها أولاً.",
    );
  }
  /** جلسة sandbox واحدة لكل مستخدم (IP) — تُعاد بين طلباته المتتالية. */
  const sessionKey = `render-sandbox:${ip}`;
  /** مفتاح حتمي لناتج التصيير: نفس التكوين = نفس الفيديو = رابط جاهز. */
  const cachePath = renderCachePath(compositionId, inputProps);
  const isProd = Boolean(process.env.VERCEL);
  const vcpus = isProd ? PROD_SANDBOX_VCPUS : DEV_SANDBOX_VCPUS;
  /** نمدد timeout الـ sandbox بقدر الخمول المخطط + هامش. */
  const extendTimeoutMs = SANDBOX_IDLE_STOP_MS + 30_000;

  const send = async (message: RenderProgress) => {
    await writer.write(encoder.encode(formatSSE(message)));
  };

  /** تسجيل مقاييس عملية ناجحة (كاش أو تصيير) وإرجاع أرقامها للعميل. */
  const reportSuccess = (
    sandboxStartMs: number,
    size: number,
    cached: boolean,
  ) => {
    const sandboxWallSeconds = Math.round((Date.now() - sandboxStartMs) / 1000);
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
  const reportFailure = (sandboxStartMs: number) => {
    const sandboxWallSeconds = Math.round((Date.now() - sandboxStartMs) / 1000);
    if (sandboxWallSeconds > 3) {
      logRenderMetrics({
        compositionId,
        cachePath,
        cached: false,
        sandboxWallSeconds,
        vcpus,
        blobBytes: 0,
        estimatedCostUsd: estimateRenderCostUsd({
          sandboxWallSeconds,
          vcpus,
          blobBytes: 0,
        }),
      });
    }
  };

  /**
   * التصيير الكامل على sandbox جاهز: الحزمة (محلياً) + render + رفع للكاش.
   * يُرمي أي فشل طبيعياً — الحاوية تستقبل وترسل رسالة واحدة للعميل.
   */
  const renderAndUpload = async (sandbox: VercelSandbox) => {
    if (!isProd) {
      bundleRemotionProject(".remotion");
      await addBundleToSandbox({ sandbox, bundleDir: ".remotion" });
    }

    const { sandboxFilePath, contentType } = await renderMediaOnVercel({
      sandbox,
      compositionId,
      inputProps: inputProps as Record<string, unknown>,
      // جودة/توازي مضبوط حسب vCPU (بند #6 من المرحلة 3):
      // - إنتاجًا (2 vCPU): جذر متوازي واحد كي لا تتضارب الصفوف على المعالجات،
      //   وتصوير JPEG قياسي (80 يكفي لمؤلات 9:16 مع الكارد).
      // - محليًا (4 vCPU): محدّدة متصلان للمعاينة الأسرع.
      concurrency: isProd ? 1 : 2,
      jpegQuality: 80,
      onProgress: async (update) => {
        switch (update.stage) {
          case "opening-browser":
            await send({
              type: "phase",
              phase: "Opening browser...",
              progress: update.overallProgress,
            });
            break;
          case "selecting-composition":
            await send({
              type: "phase",
              phase: "Selecting composition...",
              progress: update.overallProgress,
            });
            break;
          case "render-progress":
            await send({
              type: "phase",
              phase: "Rendering video...",
              progress: update.overallProgress,
            });
            break;
          default:
            break;
        }
      },
    });

    await send({ type: "phase", phase: "Uploading video...", progress: 1 });

    // ملاحظة: put() يفشل بقصر في سباق نادر حين يُصيَّر نفس التكوين مرتين
    // بالتوازي (allowOverwrite=false) — تحمّل مقبول لمحدود معدل الطلبات.
    return uploadToVercelBlob({
      sandbox,
      sandboxFilePath,
      blobPath: cachePath,
      contentType,
      blobToken,
      access: "public",
    });
  };

  const createNewSandbox = async (): Promise<VercelSandbox> => {
    await send({ type: "phase", phase: "Creating sandbox...", progress: 0 });
    return isProd
      ? await restoreSnapshot(vcpus)
      : await createSandbox({
          onProgress: async ({ progress, message }) => {
            await send({
              type: "phase",
              phase: message,
              progress,
              subtitle: "This is only needed during development.",
            });
          },
        });
  };

  /** إبقاء الجلسة حية في الإنتاج؛ محلياً نوقف (الحزمة تُرفع من جديد كل مرة). */
  const keepOrStop = async (sandbox: VercelSandbox) => {
    if (isProd) {
      holdSessionSandbox(sessionKey, sandbox, extendTimeoutMs);
    } else {
      await sandbox.stop().catch(() => {});
    }
  };

  const runRender = async () => {
    const sandboxStartMs = Date.now();
    /** جلسة أُعيد استخدامها؟ (يستحق فقط إعادة محاولة واحدة على sandbox جديد) */
    let reused = false;
    /** مرجع الجلسة الحالية — لإفهامها عند الخطأ وإعادتها عند النجاح. */
    let sandbox: VercelSandbox | null = null;
    try {
      // 1) الكاش أولاً — قبل أي sandbox: نتيجة سابقة = صفر تكلفة
      await send({ type: "phase", phase: "التحقق من الكاش...", progress: 0 });
      const cached = await findCachedRender(cachePath, blobToken);
      if (cached) {
        const metrics = reportSuccess(sandboxStartMs, cached.size, true);
        await send({
          type: "done",
          url: cached.url,
          size: cached.size,
          cached: true,
          metrics,
        });
        return;
      }

      // 2) sandbox: جلسة قائمة إن وجدت، وإلا إنشاء جديد
      sandbox = acquireSessionSandbox(sessionKey) as VercelSandbox | null;
      if (sandbox) {
        reused = true;
        await send({
          type: "phase",
          phase: "Reusing sandbox session...",
          progress: 0.05,
        });
      } else {
        sandbox = await createNewSandbox();
      }

      const { url, size } = await renderAndUpload(sandbox);
      const metrics = reportSuccess(sandboxStartMs, size, false);
      await keepOrStop(sandbox);

      await send({ type: "done", url, size, cached: false, metrics });
    } catch (err) {
      console.error(err);
      reportFailure(sandboxStartMs);
      // أي فشل يُنهي الجلسة — نتفادى إعادتها مع sandbox بحالة مجهولة
      await dropSessionSandbox(sessionKey);

      // الجلسة القائمة توقفت فجأة (انتهى timeout مثلًا) — محاولة واحدة أخرى
      // على sandbox حديث بدل إفشال طلب يحمل كلفة إنشاء من الصفر.
      if (isStoppedSandboxError(err) && reused && sandbox) {
        await send({
          type: "phase",
          phase: "Sandbox ended — retrying with a new one...",
          progress: 0,
        });
        const retryStartMs = Date.now();
        try {
          const fresh = await createNewSandbox();
          const { url, size } = await renderAndUpload(fresh);
          const metrics = reportSuccess(retryStartMs, size, false);
          await keepOrStop(fresh);
          await send({ type: "done", url, size, cached: false, metrics });
        } catch (retryErr) {
          console.error("retry failed:", retryErr);
          reportFailure(retryStartMs);
          await dropSessionSandbox(sessionKey);
          await send({
            type: "error",
            message: friendlyRenderError(retryErr),
          });
        }
        return;
      }

      await send({ type: "error", message: friendlyRenderError(err) });
    } finally {
      // القفل يُستهلك فقط أثناء التصيير الفعلي — يُحرَّر دائماً هنا
      await releaseRenderLock(lockKey);
      // إغلاق واحد آمن حتى مع العبارات return الداخلية أعلاه
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
