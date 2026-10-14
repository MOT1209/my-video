import React from "react";
import { AbsoluteFill } from "remotion";
import type { ShortTheme } from "../../../types/shorts";

export interface ShortPalette {
  bg: string;
  glow: string;
  accent: string;
  /** لون النص الأساسي — داكن على الخلفيات الفاتحة */
  ink: string;
  /** نص ثانوي (عداد المشاهد) */
  muted: string;
  card: string;
  cardBorder: string;
  track: string;
  bar: string;
  titleShadow: string;
  vignette: string;
}

const THEMES: Record<ShortTheme, ShortPalette> = {
  dark: {
    bg: "#0b0b12",
    glow: "rgba(124,58,237,0.35)",
    accent: "#a78bfa",
    ink: "#ffffff",
    muted: "rgba(255,255,255,0.5)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(255,255,255,0.16)",
    track: "rgba(255,255,255,0.15)",
    bar: "#a78bfa",
    titleShadow: "0 4px 30px rgba(0,0,0,0.5)",
    vignette:
      "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.45) 100%)",
  },
  paper: {
    bg: "#faf7ef",
    glow: "rgba(217,119,6,0.18)",
    accent: "#b45309",
    ink: "#1c1917",
    muted: "rgba(28,25,23,0.55)",
    card: "rgba(28,25,23,0.06)",
    cardBorder: "rgba(28,25,23,0.16)",
    track: "rgba(28,25,23,0.12)",
    bar: "#b45309",
    titleShadow: "0 4px 24px rgba(120,72,20,0.25)",
    vignette:
      "linear-gradient(to bottom, rgba(120,72,20,0.10) 0%, transparent 25%, transparent 70%, rgba(120,72,20,0.14) 100%)",
  },
  neon: {
    bg: "#041418",
    glow: "rgba(34,211,238,0.30)",
    accent: "#22d3ee",
    ink: "#ffffff",
    muted: "rgba(255,255,255,0.5)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(255,255,255,0.16)",
    track: "rgba(255,255,255,0.15)",
    bar: "#22d3ee",
    titleShadow: "0 4px 30px rgba(0,0,0,0.5)",
    vignette:
      "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.45) 100%)",
  },
  news: {
    bg: "#0a1628",
    glow: "rgba(239,68,68,0.28)",
    accent: "#f87171",
    ink: "#ffffff",
    muted: "rgba(255,255,255,0.5)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(255,255,255,0.16)",
    track: "rgba(255,255,255,0.15)",
    bar: "#f87171",
    titleShadow: "0 4px 30px rgba(0,0,0,0.5)",
    vignette:
      "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.45) 100%)",
  },
  quotes: {
    bg: "#12081f",
    glow: "rgba(232,121,249,0.30)",
    accent: "#e879f9",
    ink: "#ffffff",
    muted: "rgba(255,255,255,0.5)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(255,255,255,0.16)",
    track: "rgba(255,255,255,0.15)",
    bar: "#e879f9",
    titleShadow: "0 4px 30px rgba(0,0,0,0.5)",
    vignette:
      "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.45) 100%)",
  },
};

export const shortPalette = (theme: ShortTheme): ShortPalette => THEMES[theme];

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
          background: t.vignette,
        }}
      />
    </AbsoluteFill>
  );
};
