import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ShortTheme } from "../../../types/shorts";
import { shortPalette } from "./Background";

export const SceneCard: React.FC<{
  text: string;
  lang: "ar" | "en";
  index: number;
  total: number;
  theme: ShortTheme;
}> = ({ text, lang, index, total, theme }) => {
  const palette = shortPalette(theme);
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        paddingLeft: 72,
        paddingRight: 72,
        // نرفع البطاقة فوق منطقة الكابشن
        paddingBottom: 260,
        paddingTop: 320,
      }}
    >
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={{
          backgroundColor: palette.card,
          border: `2px solid ${palette.cardBorder}`,
          borderRadius: 32,
          padding: "36px 44px",
          textAlign: "center",
          fontSize: 46,
          fontWeight: 400,
          lineHeight: 1.6,
          color: palette.ink,
          maxWidth: "100%",
        }}
      >
        {text}
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 28,
          color: palette.muted,
          letterSpacing: 4,
        }}
      >
        {index + 1} / {total}
      </div>
    </AbsoluteFill>
  );
};

export const ShortProgress: React.FC<{ theme: ShortTheme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const palette = shortPalette(theme);
  const p = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ height: 10, backgroundColor: palette.track }}>
        <div style={{ width: `${p * 100}%`, height: "100%", backgroundColor: palette.bar }} />
      </div>
    </AbsoluteFill>
  );
};
