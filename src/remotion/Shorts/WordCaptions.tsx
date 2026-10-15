import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage, TikTokToken } from "@remotion/captions";
import { fitText } from "@remotion/layout-utils";
import {
  SHORT_SAFE_BOTTOM,
  SHORT_WIDTH,
  type CaptionStyle,
  type ShortLang,
  type WordCaption,
} from "../../../types/shorts";
import { shortFontFamily } from "./font";

/* ------------------------------------------------------------------ *
 * ثوابت التخطيط — مطابقة للتصميم القديم (حبيبات + هوامش 56px)
 * ------------------------------------------------------------------ */

const HORIZONTAL_MARGIN = 56;
const TOKEN_GAP = 14;
const PILL_PAD_X = 18;
const PILL_PAD_Y = 6;

const DESIRED_FONT_SIZE = 58;
const MIN_FONT_SIZE = 28;

/** عدد الميلي-ثواني الذي تُجمع خلاله الكلمات في صفحة واحدة */
const DEFAULT_COMBINE_MS = 900;

/** أقصى تكبير للكلمة النشطة (يطابق السلوك القديم scale(1.06)) */
const POP_SCALE = 1.06;
const GLOW_SCALE = 1.1;
/** مدة حركة الدخول بالإطارات */
const ENTER_FRAMES = 4;

const FONT_WEIGHT = 700;

const INK = "rgba(255,255,255,0.92)";
const PILL_IDLE = "rgba(0,0,0,0.35)";

/* ------------------------------------------------------------------ *
 * تكييف الأنواع: WordCaption (ثوانٍ) ← Caption (ميلي-ثانية)
 * ------------------------------------------------------------------ */

const toRemotionCaptions = (captions: WordCaption[]): Caption[] =>
  captions.map((c) => ({
    text: c.word.trim(),
    startMs: Math.round(c.start * 1000),
    endMs: Math.round(c.end * 1000),
    timestampMs: null,
    confidence: null,
  }));

/* ------------------------------------------------------------------ *
 * حركة الكلمة الواحدة
 * ------------------------------------------------------------------ */

type TokenMotion = {
  /** مدى التكبير: 0 = بلا تكبير، 1 = التكبير الكامل للنمط */
  progress: number;
  /** إزاحة رأسية بالبكسل (لنمط slide-up) */
  translateY: number;
  /** الشفافية (لنمط slide-up) */
  opacity: number;
  /** مدى تعبئة الكاريوكي داخل الحبة: 0 → 1 */
  fill: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const getTokenMotion = ({
  currentTimeMs,
  fps,
  token,
}: {
  readonly currentTimeMs: number;
  readonly fps: number;
  readonly token: TikTokToken;
}): TokenMotion => {
  const isActive =
    currentTimeMs >= token.fromMs && currentTimeMs < token.toMs;

  // خارج نافذة الكلمة: بلا حركة على الإطلاق
  if (!isActive) {
    return { progress: 0, translateY: 0, opacity: 1, fill: 0 };
  }

  const durationInFrames = Math.max(
    1,
    ((token.toMs - token.fromMs) / 1000) * fps,
  );
  const localFrame = ((currentTimeMs - token.fromMs) / 1000) * fps;

  // حركة دخول ناعمة (spring بدون ارتداد) ثم خروج تدريجي
  const enter = spring({
    config: { damping: 200 },
    durationInFrames: Math.min(ENTER_FRAMES, durationInFrames / 2),
    fps,
    frame: localFrame,
  });
  const exit = interpolate(
    localFrame,
    [durationInFrames - ENTER_FRAMES, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // min(enter, exit) يمنح دخولاً ثم ثباتاً ثم خروجاً بدون قطع مفاجئ
  const progress = clamp01(Math.min(enter, exit));

  // تقدّم خطي عبر الكلمة — يُستخدم لكاريوكي و slide-up
  const linear = clamp01(
    (currentTimeMs - token.fromMs) / Math.max(1, token.toMs - token.fromMs),
  );

  return {
    progress,
    translateY: (1 - progress) * 16,
    opacity: 0.35 + progress * 0.65,
    fill: linear,
  };
};

/* ------------------------------------------------------------------ *
 * المكوّن
 * ------------------------------------------------------------------ */

export const WordCaptions: React.FC<{
  captions: WordCaption[];
  lang: ShortLang;
  accent?: string;
  /** نمط التحريك — الافتراضي pop */
  style?: CaptionStyle;
  /** كلمات لكل صفحة — أصغر = أسرع تبديلاً */
  combineMs?: number;
}> = ({
  captions,
  lang,
  accent = "#a78bfa",
  style = "pop",
  combineMs = DEFAULT_COMBINE_MS,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const remotionCaptions = useMemo(
    () => toRemotionCaptions(captions),
    [captions],
  );

  // تقسيم الكلمات إلى "صفحات" بأسلوب TikTok — أسرع بكثير من النافذة اليدوية
  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions: remotionCaptions,
        combineTokensWithinMilliseconds: combineMs,
      }),
    [remotionCaptions, combineMs],
  );

  const activePageIndex = useMemo(() => {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (currentTimeMs >= p.startMs && currentTimeMs < p.startMs + p.durationMs) {
        return i;
      }
    }
    return -1;
  }, [pages, currentTimeMs]);

  const page: TikTokPage | null =
    activePageIndex >= 0 ? pages[activePageIndex] : null;

  // قياس الخط مرة واحدة لكل صفحة (وليس كل إطار) — fitText يقيس DOM
  const fontSize = useMemo(() => {
    if (!page || page.tokens.length === 0) {
      return DESIRED_FONT_SIZE;
    }
    const availableWidth = SHORT_WIDTH - HORIZONTAL_MARGIN * 2;
    const n = page.tokens.length;
    // احجز مساحة الحبيبات والمسافات حتى لا يفيض السطر
    const reserved =
      (n - 1) * TOKEN_GAP + n * PILL_PAD_X * 2;
    const textWidth = Math.max(140, availableWidth - reserved);

    const measured = fitText({
      text: page.text.trim(),
      withinWidth: textWidth,
      fontFamily: shortFontFamily,
      fontWeight: FONT_WEIGHT,
      validateFontIsLoaded: false,
    }).fontSize;

    return Math.min(DESIRED_FONT_SIZE, Math.max(MIN_FONT_SIZE, measured));
  }, [page]);

  if (!page) {
    return null;
  }

  const dir = lang === "ar" ? "rtl" : "ltr";
  const activeTokenIndex = page.tokens.findIndex(
    (t) => currentTimeMs >= t.fromMs && currentTimeMs < t.toMs,
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: SHORT_SAFE_BOTTOM + 60,
        paddingLeft: HORIZONTAL_MARGIN,
        paddingRight: HORIZONTAL_MARGIN,
      }}
    >
      <div
        dir={dir}
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: TOKEN_GAP,
          maxWidth: SHORT_WIDTH - HORIZONTAL_MARGIN * 2,
        }}
      >
        {page.tokens.map((token, tokenIndex) => {
          const visible = token.text.trim();
          if (!visible) {
            return null;
          }

          const motion = getTokenMotion({
            currentTimeMs,
            fps,
            token,
          });

          const isActive = tokenIndex === activeTokenIndex;

          return (
            <TokenPill
              key={`${page.startMs}-${token.fromMs}-${tokenIndex}`}
              visible={visible}
              isActive={isActive}
              motion={motion}
              style={style}
              accent={accent}
              fontSize={fontSize}
              dir={dir}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ *
 * حبة كلمة واحدة — العنصر البصري القابل لإعادة الاستخدام
 * ------------------------------------------------------------------ */

const TokenPill: React.FC<{
  visible: string;
  isActive: boolean;
  motion: TokenMotion;
  style: CaptionStyle;
  accent: string;
  fontSize: number;
  dir: "rtl" | "ltr";
}> = ({ visible, isActive, motion, style, accent, fontSize, dir }) => {
  // النمط المختار يحدّد شكل التفاعل
  const scale =
    style === "pop"
      ? 1 + motion.progress * (POP_SCALE - 1)
      : style === "glow"
        ? 1 + motion.progress * (GLOW_SCALE - 1)
        : 1;

  const translateY = style === "slide-up" ? motion.translateY : 0;
  const opacity = style === "slide-up" ? motion.opacity : 1;

  // لون النص: الكلمة النشطة تأخذ لون الـ accent في أنماط pop/glow/slide-up
  const textColor =
    isActive && style !== "karaoke" ? accent : INK;

  // كاريوكي: تعبئة الحبة تمرّ عبر الكلمة مثل موجة صوتية.
  // الاتجاه يتبع لغة النص: LTR يملأ من اليسار، RTL (عربي) من اليمين.
  const karaokeFill =
    style === "karaoke" && isActive
      ? `linear-gradient(${dir === "rtl" ? 270 : 90}deg, ${accent} 0%, ${accent} ${motion.fill * 100}%, transparent ${motion.fill * 100}%, transparent 100%)`
      : null;

  // glow: هالة بلون الـ accent تتوهج مع الدخول
  const boxShadow =
    style === "glow" && isActive
      ? `0 0 ${12 + motion.progress * 26}px ${accent}, 0 2px 12px rgba(0,0,0,0.6)`
      : "0 2px 12px rgba(0,0,0,0.6)";

  return (
    <span
      dir={dir}
      style={{
        display: "inline-block",
        fontFamily: shortFontFamily,
        fontWeight: FONT_WEIGHT,
        fontSize,
        lineHeight: 1.3,
        color: textColor,
        backgroundColor: karaokeFill ? "rgba(0,0,0,0.35)" : PILL_IDLE,
        backgroundImage: karaokeFill ?? undefined,
        backgroundClip: karaokeFill ? "border-box" : undefined,
        padding: `${PILL_PAD_Y}px ${PILL_PAD_X}px`,
        borderRadius: 16,
        boxShadow,
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: "center bottom",
        opacity,
        // يمنع التمدد غير المرئي للفجوف داخل الحبة
        whiteSpace: "pre",
        willChange: "transform, opacity",
      }}
    >
      {visible}
    </span>
  );
};
