import {
  addBundleToSandbox,
  createSandbox,
  renderMediaOnVercel,
  uploadToVercelBlob,
  type VercelSandbox,
} from "@remotion/vercel";
import { bundleRemotionProject } from "./remotion-bundle";
import { isStoppedSandboxError } from "./render-errors";
import { DEV_SANDBOX_VCPUS, PROD_SANDBOX_VCPUS } from "./render-metrics";
import { isSandboxSnapshotUnavailableError } from "./snapshot-errors";
import { restoreSnapshot } from "./restore-snapshot";
import {
  acquireSessionSandbox,
  dropSessionSandbox,
  holdSessionSandbox,
  SANDBOX_IDLE_STOP_MS,
} from "./sandbox-session";

/**
 * مشغّل التصيير الواحد — مشترك بين مسار الـ SSE التفاعلي ومهمة
 * إعادة المحاولة من الطابور (Phase 3 #3)، كي لا يتفرّع منطق الـ sandbox
 * في نسختين تتباعدان مع الزمن.
 *
 * يتولّى كامل دورة الحياة: جلسة قائمة أو إنشاء جديد → تصيير → رفع للكاش،
 * مع محاولة ثانية واحدة إذا توقف الـ sandbox بين الطلبات.
 */

/** ما يُبلَّغ للعميل أثناء التصيير (مسار SSE فقط). */
export interface RenderPhase {
  phase: string;
  progress: number;
  subtitle?: string;
}

export type ProgressReporter = (event: RenderPhase) => Promise<void> | void;

export interface RunRenderOptions {
  compositionId: string;
  inputProps: Record<string, unknown>;
  /** مسار Blob الحتمي الذي يُرفع إليه الناتج (ويتلقّطه فحص الكاش لاحقاً). */
  blobPath: string;
  blobToken: string;
  /** مفتاح جلسة الـ sandbox — مستخدِم/موضوع واحد لكل جلسة. */
  sessionKey: string;
  onProgress?: ProgressReporter;
}

export interface RunRenderOutcome {
  url: string;
  size: number;
  /** هل أُعيد استعمال جلسة sandbox قائمة (توفير إنشاء/تثبيت)؟ */
  reusedSandbox: boolean;
  sandboxWallSeconds: number;
}

/** هل نعمل على Vercel (snapshot جاهز) أم محلياً (حزمة + sandbox من الصفر)؟ */
export function isProductionRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

/** عدد vCPUs المطابق لبيئة التشغيل — يُستعمل في حساب $/video أيضاً. */
export function runtimeVcpus(isProd: boolean): number {
  return isProd ? PROD_SANDBOX_VCPUS : DEV_SANDBOX_VCPUS;
}

interface CreatedRenderSandbox {
  sandbox: VercelSandbox;
  /** Fresh sandboxes need the bundled Remotion project uploaded before rendering. */
  needsBundleUpload: boolean;
}

async function createRenderSandbox(
  options: RunRenderOptions,
  isProd: boolean,
): Promise<CreatedRenderSandbox> {
  await options.onProgress?.({ phase: "Creating sandbox...", progress: 0 });
  const onProgress = async ({
    progress,
    message,
  }: {
    progress: number;
    message: string;
  }) => {
    await options.onProgress?.({
      phase: message,
      progress,
      subtitle: isProd
        ? "Preparing a fresh render environment."
        : "This is only needed during development.",
    });
  };

  if (isProd) {
    try {
      return {
        sandbox: await restoreSnapshot(runtimeVcpus(isProd)),
        needsBundleUpload: false,
      };
    } catch (error) {
      if (!isSandboxSnapshotUnavailableError(error)) throw error;
      console.warn(
        "[Render] No usable deployment snapshot; creating a fresh sandbox and uploading the bundled Remotion project.",
      );
      return {
        sandbox: await createSandbox({
          resources: { vcpus: runtimeVcpus(isProd) },
          onProgress,
        }),
        needsBundleUpload: true,
      };
    }
  }

  return {
    sandbox: await createSandbox({ onProgress }),
    needsBundleUpload: true,
  };
}

/** تصيير ورفع على sandbox جاهز — يُرمي أي فشل طبيعياً. */
async function renderAndUpload(
  sandbox: VercelSandbox,
  options: RunRenderOptions,
  isProd: boolean,
  needsBundleUpload: boolean,
): Promise<{ url: string; size: number }> {
  if (needsBundleUpload) {
    if (!isProd) bundleRemotionProject(".remotion");
    await addBundleToSandbox({ sandbox, bundleDir: ".remotion" });
  }

  const { sandboxFilePath, contentType } = await renderMediaOnVercel({
    sandbox,
    compositionId: options.compositionId,
    inputProps: options.inputProps,
    // جودة/توازي مضبوط حسب vCPU (بند #6 من المرحلة 3):
    // - إنتاجاً (2 vCPU): مسار متوازٍ واحد كي لا تتنافس الصفوف على المعالجات،
    //   وتصوير JPEG قياسي (80 يكفي لملصقات 9:16 مع الكارد).
    // - محلياً (4 vCPU): محدّدان متوازيان للمعاينة الأسرع.
    concurrency: isProd ? 1 : 2,
    jpegQuality: 80,
    onProgress: async (update) => {
      switch (update.stage) {
        case "opening-browser":
          await options.onProgress?.({
            phase: "Opening browser...",
            progress: update.overallProgress,
          });
          break;
        case "selecting-composition":
          await options.onProgress?.({
            phase: "Selecting composition...",
            progress: update.overallProgress,
          });
          break;
        case "render-progress":
          await options.onProgress?.({
            phase: "Rendering video...",
            progress: update.overallProgress,
          });
          break;
        default:
          break;
      }
    },
  });

  await options.onProgress?.({ phase: "Uploading video...", progress: 1 });

  // ملاحظة: put() يفشل بصراع نادر حين يُصيَّر نفس التكوين مرتين بالتوازي
  // (allowOverwrite=false) — تحمّل مقبول تحت حد المعدل وقفل التصيير.
  return uploadToVercelBlob({
    sandbox,
    sandboxFilePath,
    blobPath: options.blobPath,
    contentType,
    blobToken: options.blobToken,
    access: "public",
  });
}

/** إبقاء الجلسة حية في الإنتاج؛ محلياً نوقف (الحزمة تُرفع من جديد كل مرة). */
async function keepOrStop(
  sandbox: VercelSandbox,
  options: RunRenderOptions,
  isProd: boolean,
): Promise<void> {
  if (isProd) {
    holdSessionSandbox(
      options.sessionKey,
      sandbox,
      SANDBOX_IDLE_STOP_MS + 30_000,
    );
  } else {
    await sandbox.stop().catch(() => {});
  }
}

async function attempt(
  options: RunRenderOptions,
  isProd: boolean,
  allowReuse: boolean,
): Promise<RunRenderOutcome> {
  const startMs = Date.now();
  let sandbox: VercelSandbox | null = allowReuse
    ? (acquireSessionSandbox(options.sessionKey) as VercelSandbox | null)
    : null;
  const reusedSandbox = Boolean(sandbox);
  let needsBundleUpload = false;
  if (sandbox) {
    await options.onProgress?.({
      phase: "Reusing sandbox session...",
      progress: 0.05,
    });
  } else {
    const created = await createRenderSandbox(options, isProd);
    sandbox = created.sandbox;
    needsBundleUpload = created.needsBundleUpload;
  }

  try {
    const { url, size } = await renderAndUpload(
      sandbox,
      options,
      isProd,
      needsBundleUpload,
    );
    await keepOrStop(sandbox, options, isProd);
    return {
      url,
      size,
      reusedSandbox,
      sandboxWallSeconds: Math.round((Date.now() - startMs) / 1000),
    };
  } catch (err) {
    // أي فشل يُنهي الجلسة — لا إعادة استعمال مع sandbox بحالة مجهولة
    await dropSessionSandbox(options.sessionKey);
    // الجلسة القائمة توقفت فجأة (انتهى timeout مثلاً): محاولة واحدة
    // على sandbox حديث بدل إفشال طلب يحمل كلفة إنشاء كاملة.
    if (reusedSandbox && isStoppedSandboxError(err)) {
      await options.onProgress?.({
        phase: "Sandbox ended — retrying with a new one...",
        progress: 0,
      });
      return attempt(options, isProd, false);
    }
    throw err;
  }
}

export async function runRenderOnce(
  options: RunRenderOptions,
): Promise<RunRenderOutcome> {
  return attempt(options, isProductionRuntime(), true);
}
