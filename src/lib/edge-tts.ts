import { Buffer } from "node:buffer";
import { WebSocket } from "ws";
import type { WordCaption } from "../../types/shorts";

const BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TOKEN}`;

export interface EdgeSynthesis {
  audio: Buffer;
  captions: WordCaption[];
  durationSec: number;
}

interface WordBoundaryData {
  Offset: number;
  Duration: number;
  text: { Text: string; Length: number };
}

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function uuid(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/**
 * Edge TTS مع حدود الكلمات (word boundaries) لتوليد كابشن متزامن.
 * مبني على نفس بروتوكول حزمة edge-tts لكن مع wordBoundaryEnabled: true.
 */
export function synthesizeWithWordBoundaries(
  text: string,
  voice: string,
  opts: { rate?: string; timeoutMs?: number } = {},
): Promise<EdgeSynthesis> {
  const { rate = "+0%", timeoutMs = 60000 } = opts;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        // تجاهل
      }
      reject(new Error("Edge TTS timed out"));
    }, timeoutMs);

    const finish = (result: EdgeSynthesis) => {
      clearTimeout(timer);
      resolve(result);
    };
    const fail = (err: Error) => {
      clearTimeout(timer);
      reject(err);
    };

    const ws = new WebSocket(`${WS_URL}&ConnectionId=${uuid()}`, {
      host: "speech.platform.bing.com",
      origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.66 Safari/537.36 Edg/103.0.1264.44",
      },
    });

    const audioChunks: Buffer[] = [];
    const boundaries: { word: string; start: number; end: number }[] = [];

    ws.on("message", (rawData: Buffer | string, isBinary: boolean) => {
      try {
        if (isBinary) {
          const data = rawData as Buffer;
          const separator = "Path:audio\r\n";
          const idx = data.indexOf(separator);
          if (idx !== -1) {
            audioChunks.push(data.subarray(idx + separator.length));
          }
          return;
        }

        const msg = rawData.toString("utf8");

        if (msg.includes("Path:audio.metadata")) {
          const payload = msg.split("\r\n\r\n").at(-1) ?? "";
          const parsed = JSON.parse(payload) as {
            Metadata?: { Type: string; Data: WordBoundaryData }[];
          };
          for (const item of parsed.Metadata ?? []) {
            if (item.Type !== "WordBoundary") {
              continue;
            }
            const start = item.Data.Offset / 1e7;
            const end = (item.Data.Offset + item.Data.Duration) / 1e7;
            boundaries.push({
              word: item.Data.text.Text,
              start: Number(start.toFixed(3)),
              end: Number(end.toFixed(3)),
            });
          }
          return;
        }

        if (msg.includes("turn.end")) {
          const audio = Buffer.concat(
            audioChunks as unknown as Uint8Array<ArrayBuffer>[],
          );
          const captions: WordCaption[] = boundaries.map((b) => ({
            word: b.word,
            start: b.start,
            end: b.end,
          }));
          const lastEnd = captions.length > 0 ? captions[captions.length - 1].end : 0;
          ws.close();
          finish({ audio, captions, durationSec: Number((lastEnd + 0.4).toFixed(3)) });
        }
      } catch (err) {
        fail(err as Error);
      }
    });

    ws.on("error", (err) => fail(err as Error));

    const speechConfig = JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: {
              sentenceBoundaryEnabled: false,
              wordBoundaryEnabled: true,
            },
            outputFormat: "audio-24khz-48kbitrate-mono-mp3",
          },
        },
      },
    });
    const configMessage =
      `X-Timestamp:${Date()}\r\n` +
      `Content-Type:application/json; charset=utf-8\r\n` +
      `Path:speech.config\r\n\r\n${speechConfig}`;

    ws.on("open", () => {
      ws.send(configMessage, { compress: true }, (configError) => {
        if (configError) {
          fail(configError as Error);
          return;
        }
        const ssmlMessage =
          `X-RequestId:${uuid()}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${Date()}Z\r\n` +
          `Path:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'>` +
          `<prosody rate='${rate}'>${escapeSsml(text)}</prosody>` +
          `</voice></speak>`;
        ws.send(ssmlMessage, { compress: true }, (ssmlError) => {
          if (ssmlError) {
            fail(ssmlError as Error);
          }
        });
      });
    });
  });
}
