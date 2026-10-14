import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SHORT_SAFE_TOP, type ShortLang, type ShortTheme } from "../../../types/shorts";
import { shortPalette } from "./Background";
import { shortFontFamily } from "./font";

export const HookTitle: React.FC<{
  hook: string;
  lang: ShortLang;
  theme: ShortTheme;
}> = ({ hook, lang, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = shortPalette(theme);

  const progress = spring({ fps, frame, config: { damping: 200 } });
  const opacity = Math.min(1, progress * 1.5);
  const translateY = (1 - Math.min(1, progress)) * 40;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: SHORT_SAFE_TOP,
        paddingLeft: 64,
        paddingRight: 64,
      }}
    >
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={{
          fontFamily: shortFontFamily,
          fontWeight: 700,
          fontSize: 64,
          lineHeight: 1.35,
          textAlign: "center",
          color: palette.ink,
          opacity,
          transform: `translateY(${translateY}px)`,
          textShadow: palette.titleShadow,
        }}
      >
        {hook}
      </div>
    </AbsoluteFill>
  );
};
