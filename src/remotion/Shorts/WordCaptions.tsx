import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  SHORT_SAFE_BOTTOM,
  type ShortLang,
  type WordCaption,
} from "../../../types/shorts";
import { shortFontFamily } from "./font";

const WINDOW_SIZE = 8;
const WORDS_PER_LINE = 3;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export const WordCaptions: React.FC<{
  captions: WordCaption[];
  lang: ShortLang;
  accent?: string;
}> = ({ captions, lang, accent = "#a78bfa" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const activeIdx = useMemo(() => {
    if (captions.length === 0) {
      return -1;
    }
    // آخر كلمة بدأت قبل اللحظة الحالية
    let idx = -1;
    for (let i = 0; i < captions.length; i++) {
      if (captions[i].start <= t) {
        idx = i;
      } else {
        break;
      }
    }
    // قبل أول كلمة: اعرض من البداية بدون تمييز
    return idx === -1 ? 0 : idx;
  }, [captions, t]);

  const window = useMemo(() => {
    if (captions.length === 0) {
      return [];
    }
    // نافذة تتبع الكلمة النشطة: 2 قبلها + الباقي بعدها
    const start = Math.max(0, Math.min(activeIdx - 2, captions.length - WINDOW_SIZE));
    return captions
      .slice(start, start + WINDOW_SIZE)
      .map((c, k) => ({ ...c, globalIdx: start + k }));
  }, [captions, activeIdx]);

  if (window.length === 0) {
    return null;
  }

  const lines = chunk(window, WORDS_PER_LINE);
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: SHORT_SAFE_BOTTOM + 60,
        paddingLeft: 56,
        paddingRight: 56,
      }}
    >
      <div
        dir={dir}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        {lines.map((line, li) => (
          <div
            key={li}
            dir={dir}
            style={{ display: "flex", gap: 14, alignItems: "baseline" }}
          >
            {line.map((w) => {
              const isActive = w.globalIdx === activeIdx;
              return (
                <span
                  key={w.globalIdx}
                  style={{
                    fontFamily: shortFontFamily,
                    fontWeight: 700,
                    fontSize: isActive ? 58 : 52,
                    lineHeight: 1.3,
                    color: isActive ? accent : "rgba(255,255,255,0.92)",
                    backgroundColor: isActive ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)",
                    padding: "6px 18px",
                    borderRadius: 16,
                    textShadow: "0 2px 12px rgba(0,0,0,0.6)",
                    transform: isActive ? "scale(1.06)" : undefined,
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
