"use client";

import { Player } from "@remotion/player";
import React, { useMemo, useState } from "react";
import {
  AR_VOICES,
  buildNarrationText,
  defaultShortProps,
  EN_VOICES,
  getShortDurationInFrames,
  SHORT_COMP_NAME,
  SHORT_FPS,
  SHORT_HEIGHT,
  SHORT_WIDTH,
  ShortTheme,
  type ShortProps,
  type WordCaption,
} from "../../types/shorts";
import { useRendering } from "../helpers/use-rendering";
import { AlignEnd } from "./AlignEnd";
import { Button } from "./Button";
import { InputContainer } from "./Container";
import { DownloadButton } from "./DownloadButton";
import { ErrorComp } from "./Error";
import { ProgressBar } from "./ProgressBar";
import { Spacing } from "./Spacing";
import { ShortMain } from "../remotion/Shorts/ShortMain";

type TtsStatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; cached: boolean }
  | { status: "error"; message: string };

const THEME_LABELS: { id: ShortTheme; label: string }[] = [
  { id: "dark", label: "داكن" },
  { id: "paper", label: "ورقي فاتح" },
  { id: "neon", label: "نيون" },
  { id: "news", label: "إخباري" },
  { id: "quotes", label: "اقتباسات" },
];

export const ShortsEditor: React.FC = () => {
  const [hook, setHook] = useState(defaultShortProps.hook);
  const [scenesText, setScenesText] = useState(
    defaultShortProps.scenes.map((s) => s.text).join("\n"),
  );
  const [theme, setTheme] = useState<ShortTheme>("dark");
  const [voiceId, setVoiceId] = useState<string>(defaultShortProps.voiceId);
  const [tts, setTts] = useState<TtsStatus>({ status: "idle" });
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [captions, setCaptions] = useState<WordCaption[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const scenes = useMemo(() => {
    return scenesText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((text, i) => ({ id: `s${i + 1}`, text, imageUrl: null }));
  }, [scenesText]);

  const narrationText = useMemo(
    () => buildNarrationText({ hook, scenes }),
    [hook, scenes],
  );

  const lang = voiceId.startsWith("ar") ? "ar" : "en";

  const inputProps: ShortProps = useMemo(
    () => ({
      hook: hook.trim() || defaultShortProps.hook,
      scenes: scenes.length > 0 ? scenes : defaultShortProps.scenes,
      theme,
      lang,
      voiceId,
      audioUrl,
      audioDurationSec,
      captions,
      musicUrl: null,
      musicDuck: 0.15,
    }),
    [hook, scenes, theme, lang, voiceId, audioUrl, audioDurationSec, captions],
  );

  const durationInFrames = useMemo(
    () => getShortDurationInFrames({ captions, audioDurationSec }),
    [captions, audioDurationSec],
  );

  const { renderMedia, state, undo } = useRendering(SHORT_COMP_NAME, inputProps);

  const generateAudio = async () => {
    setFormError(null);
    if (scenes.length === 0) {
      setFormError("أضف مشهداً واحداً على الأقل (سطر واحد = مشهد)");
      return;
    }
    setTts({ status: "loading" });
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: narrationText, voiceId }),
      });
      const json = await res.json();
      if (json.type !== "success") {
        throw new Error(json.message ?? "فشل توليد الصوت");
      }
      const data = json.data as {
        audioUrl: string;
        captions: WordCaption[];
        durationSec: number;
        cached: boolean;
      };
      setAudioUrl(data.audioUrl);
      setAudioDurationSec(data.durationSec);
      setCaptions(data.captions);
      setTts({ status: "ready", cached: data.cached });
    } catch (err) {
      setTts({ status: "error", message: (err as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start" dir="rtl">
      {/* المحرر */}
      <InputContainer>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">الخطاف (أول ثانيتين)</label>
          <input
            value={hook}
            onChange={(e) => setHook(e.currentTarget.value)}
            maxLength={120}
            placeholder="عنوان يجذب الانتباه فوراً"
            className="leading-[1.7] block w-full rounded bg-background p-2 text-sm border outline-none"
          />
        </div>

        <Spacing />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">المشاهد (سطر = مشهد، حتى 12)</label>
          <textarea
            value={scenesText}
            onChange={(e) => setScenesText(e.currentTarget.value)}
            rows={5}
            placeholder={"سطر لكل مشهد\nمثال: العادة الصغيرة تهزم الحماس الكبير"}
            className="leading-[1.7] block w-full rounded bg-background p-2 text-sm border outline-none"
          />
          <div className="text-xs opacity-60">
            {scenes.length} مشاهد · {narrationText.length} حرف للتعليق
          </div>
        </div>

        <Spacing />

        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-sm font-medium">الثيم</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.currentTarget.value as ShortTheme)}
              className="rounded bg-background p-2 text-sm border outline-none"
            >
              {THEME_LABELS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-sm font-medium">الصوت</label>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.currentTarget.value)}
              className="rounded bg-background p-2 text-sm border outline-none"
            >
              <optgroup label="عربي">
                {AR_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="English">
                {EN_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <Spacing />

        <AlignEnd>
          <Button
            disabled={tts.status === "loading"}
            loading={tts.status === "loading"}
            onClick={generateAudio}
          >
            {audioUrl ? "إعادة توليد الصوت" : "توليد الصوت"}
          </Button>
        </AlignEnd>

        {tts.status === "ready" && audioUrl ? (
          <div className="text-xs opacity-70 mt-2">
            تم توليد الصوت ({audioDurationSec?.toFixed(1)} ثانية · {captions.length} كلمة
            {tts.cached ? " · من الكاش" : ""})
            <audio controls src={audioUrl} className="w-full mt-2" />
          </div>
        ) : null}
        {tts.status === "error" ? <ErrorComp message={tts.message} /> : null}
        {formError ? <ErrorComp message={formError} /> : null}

        <Spacing />

        {state.status === "done" ? (
          <>
            <ProgressBar progress={1} />
            <Spacing />
            <AlignEnd>
              <DownloadButton undo={undo} state={state} />
            </AlignEnd>
          </>
        ) : (
          <>
            <AlignEnd>
              <Button
                disabled={state.status === "invoking" || !audioUrl}
                loading={state.status === "invoking"}
                onClick={renderMedia}
              >
                تصيير الفيديو
              </Button>
            </AlignEnd>
            {!audioUrl ? (
              <div className="text-xs opacity-60 mt-2">
                ولّد الصوت أولاً — مدة الفيديو تُحسب من مدة التعليق (حتى 60 ثانية)
              </div>
            ) : null}
            {state.status === "invoking" ? (
              <>
                <Spacing />
                <div className="text-sm opacity-70">
                  {state.phase} {Math.round(state.progress * 100)}%
                </div>
                <ProgressBar progress={state.progress} />
              </>
            ) : null}
            {state.status === "error" ? (
              <ErrorComp message={state.error.message} />
            ) : null}
          </>
        )}
      </InputContainer>

      {/* المعاينة العمودية */}
      <div className="mx-auto w-full max-w-[320px] shrink-0 overflow-hidden rounded-xl shadow-[0_0_200px_rgba(0,0,0,0.15)]">
        <Player
          component={ShortMain}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          fps={SHORT_FPS}
          compositionWidth={SHORT_WIDTH}
          compositionHeight={SHORT_HEIGHT}
          acknowledgeRemotionLicense
          style={{ width: "100%" }}
          controls
          autoPlay
          loop
        />
        <div className="text-xs text-center opacity-60 py-2">
          معاينة 9:16 · {(durationInFrames / SHORT_FPS).toFixed(1)} ثانية
        </div>
      </div>
    </div>
  );
};
