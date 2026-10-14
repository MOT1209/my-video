import {
  addBundleToSandbox,
  createSandbox,
  renderMediaOnVercel,
  uploadToVercelBlob,
} from "@remotion/vercel";
import { BlobAccessError } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
import { COMP_NAME, CompositionProps } from "../../../../types/constants";
import { AnyRenderRequest } from "../../../../types/schema";
import { SHORT_COMP_NAME, ShortProps } from "../../../../types/shorts";
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

export async function POST(req: Request) {  const encoder = new TextEncoder();
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

  const send = async (message: RenderProgress) => {
    await writer.write(encoder.encode(formatSSE(message)));
  };

  const runRender = async () => {
    await send({ type: "phase", phase: "Creating sandbox...", progress: 0 });
    const sandbox = process.env.VERCEL
      ? await restoreSnapshot()
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

    try {
      if (!process.env.VERCEL) {
        bundleRemotionProject(".remotion");
        await addBundleToSandbox({ sandbox, bundleDir: ".remotion" });
      }

      const { sandboxFilePath, contentType } = await renderMediaOnVercel({
        sandbox,
        compositionId,
        inputProps: inputProps as Record<string, unknown>,
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

      await send({
        type: "phase",
        phase: "Uploading video...",
        progress: 1,
      });

      const { url, size } = await uploadToVercelBlob({
        sandbox,
        sandboxFilePath,
        contentType,
        blobToken,
        access: "public",
      });

      await send({ type: "done", url, size });
    } catch (err) {
      console.error(err);
      await send({ type: "error", message: friendlyRenderError(err) });
    } finally {
      await sandbox?.stop().catch(() => {});
      await writer.close();
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
