import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const SceneCard: React.FC<{
  text: string;
  lang: "ar" | "en";
  index: number;
  total: number;
}> = ({ text, lang, index, total }) => {
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
          backgroundColor: "rgba(255,255,255,0.08)",
          border: "2px solid rgba(255,255,255,0.16)",
          borderRadius: 32,
          padding: "36px 44px",
          textAlign: "center",
          fontSize: 46,
          fontWeight: 400,
          lineHeight: 1.6,
          color: "rgba(255,255,255,0.95)",
          maxWidth: "100%",
        }}
      >
        {text}
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 28,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: 4,
        }}
      >
        {index + 1} / {total}
      </div>
    </AbsoluteFill>
  );
};

export const ShortProgress: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ height: 10, backgroundColor: "rgba(255,255,255,0.15)" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", backgroundColor: "#fff" }} />
      </div>
    </AbsoluteFill>
  );
};
