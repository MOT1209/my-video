import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SHORT_SAFE_TOP, type ShortLang } from "../../../types/shorts";
import { shortFontFamily } from "./font";

export const HookTitle: React.FC<{ hook: string; lang: ShortLang }> = ({
  hook,
  lang,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
          color: "#ffffff",
          opacity,
          transform: `translateY(${translateY}px)`,
          textShadow: "0 4px 30px rgba(0,0,0,0.5)",
        }}
      >
        {hook}
      </div>
    </AbsoluteFill>
  );
};
