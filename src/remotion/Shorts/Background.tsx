import React from "react";
import { AbsoluteFill } from "remotion";
import type { ShortTheme } from "../../../types/shorts";

const THEMES: Record<ShortTheme, { bg: string; glow: string; accent: string }> = {
  dark: { bg: "#0b0b12", glow: "rgba(124,58,237,0.35)", accent: "#a78bfa" },
  paper: { bg: "#faf7ef", glow: "rgba(217,119,6,0.18)", accent: "#b45309" },
  neon: { bg: "#041418", glow: "rgba(34,211,238,0.30)", accent: "#22d3ee" },
  news: { bg: "#0a1628", glow: "rgba(239,68,68,0.28)", accent: "#f87171" },
  quotes: { bg: "#12081f", glow: "rgba(232,121,249,0.30)", accent: "#e879f9" },
};

export const ShortBackground: React.FC<{ theme: ShortTheme }> = ({ theme }) => {
  const t = THEMES[theme];
  return (
    <AbsoluteFill style={{ backgroundColor: t.bg }}>
      {/* توهج علوي */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 45% at 50% 0%, ${t.glow}, transparent 70%)`,
        }}
      />
      {/* توهج سفلي خفيف */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 100% 35% at 50% 110%, ${t.glow}, transparent 70%)`,
        }}
      />
      {/* vignette لزيادة تباين النص */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
