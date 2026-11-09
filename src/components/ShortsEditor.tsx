"use client";

import { Player } from "@remotion/player";
import React, { useEffect, useMemo, useState } from "react";
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
  CAPTION_STYLE_LABELS,
  type CaptionStyle,
  type ShortProps,
  type WordCaption,
} from "../../types/shorts";
import { AccountPanel } from "./AccountPanel";
import { useRendering } from "../helpers/use-rendering";
import {
  usePersistEditor,
  useSavedEditorState,
} from "../hooks/use-editor-state";
import { AlignEnd } from "./AlignEnd";
import { Button } from "./Button";
import { InputContainer } from "./Container";
import { DownloadButton } from "./DownloadButton";
import { ErrorComp } from "./Error";
import { ProgressBar } from "./ProgressBar";
import { Spacing } from "./Spacing";
import { ShortMain } from "../remotion/Shorts/ShortMain";
import { SHORT_TEMPLATES, type ShortTemplate } from "../../types/templates";
import { requestBackground, requestNarration, requestScript } from "../lib/editor-api";
import {
  DEFAULT_SCENES_TEXT,
  isUntouchedDraft,
  isUrlSource,
  parseScenes,
  scenesToText,
} from "../lib/editor-scenes";

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

const CAPTION_STYLE_ORDER: CaptionStyle[] = [
  "pop",
  "karaoke",
  "slide-up",
  "glow",
];

export const ShortsEditor: React.FC = () => {
  const [hook, setHook] = useState(defaultShortProps.hook);
  const [scenesText, setScenesText] = useState(DEFAULT_SCENES_TEXT);
  const [theme, setTheme] = useState<ShortTheme>("dark");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(
    defaultShortProps.captionStyle,
  );
  const [voiceId, setVoiceId] = useState<string>(defaultShortProps.voiceId);
  const [tts, setTts] = useState<TtsStatus>({ status: "idle" });
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [captions, setCaptions] = useState<WordCaption[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  /** رابط/موضوع لتوليد السكربت تلقائياً (المرحلة 2). */
  const [scriptSource, setScriptSource] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  /** خلفية AI للفيديو كله (مرحلة 2 — صورة لكل فيديو وليس لكل مشهد). */
  const [bgStatus, setBgStatus] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; cached: boolean; url: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  /** عنوان آخر مشروع حُمّل من الحساب (للعرض فقط). */
  const [loadedTitle, setLoadedTitle] = useState<string | null>(null);

  /** حفظ/تحميل المحرّر: المحفوظات تُستبدل بعد أول hydration. */
  const { saved, hydrated } = useSavedEditorState();
  useEffect(() => {
    if (!saved) {
      return;
    }
    if (typeof saved.hook === "string") {
      setHook(saved.hook);
    }
    if (typeof saved.scenesText === "string") {
      setScenesText(saved.scenesText);
    }
    if (typeof saved.theme === "string") {
      setTheme(saved.theme as ShortTheme);
    }
    if (typeof saved.captionStyle === "string") {
      setCaptionStyle(saved.captionStyle as CaptionStyle);
    }
    if (typeof saved.voiceId === "string") {
      setVoiceId(saved.voiceId);
    }
    if (typeof saved.scriptSource === "string") {
      setScriptSource(saved.scriptSource);
    }
    // الصوت/الكابشن بمقدمات مرجعية: نعيد فقط الملفات المُوافق عليها
    if (typeof saved.audioUrl === "string" && typeof saved.audioDurationSec === "number") {
      setAudioUrl(saved.audioUrl);
      setAudioDurationSec(saved.audioDurationSec);
      setTts({ status: "ready", cached: false });
    }
    if (Array.isArray(saved.captions)) {
      setCaptions(saved.captions);
    }
    // مرّة واحدة فقط بعد أول hydration — قصداً ولا يُعيد الكتابة حفظاً
  }, [hydrated]);

  /** يطبّق مشروعاً محمّلاً من حساب المستخدم على المحرّر كاملاً. */
  const applyProject = (props: ShortProps, projectTitle: string) => {
    setHook(props.hook);
    setScenesText(scenesToText(props.scenes));
    setTheme(props.theme);
    setCaptionStyle(props.captionStyle);
    setVoiceId(props.voiceId);
    setAudioUrl(props.audioUrl);
    setAudioDurationSec(props.audioDurationSec);
    setCaptions(props.captions);
    setTts(
      props.audioUrl ? { status: "ready", cached: false } : { status: "idle" },
    );
    setBgStatus(
      props.backgroundMedia
        ? { status: "ready", cached: false, url: props.backgroundMedia.url }
        : { status: "idle" },
    );
    setLoadedTitle(projectTitle);
  };

  /** يطبّق قالباً جاهزاً: يستبدل النص والإعدادات، ويصفّر الصوت لأنه لم يعد يطابق النص. */
  const applyTemplate = (template: ShortTemplate) => {
    if (
      !isUntouchedDraft(hook, scenesText) &&
      !window.confirm(`سيستبدل القالب «${template.label}» الخطاف والمشاهد الحالية. المتابعة؟`)
    ) {
      return;
    }
    setFormError(null);
    setHook(template.hook);
    setScenesText(template.scenes.join("\n"));
    setTheme(template.theme);
    setCaptionStyle(template.captionStyle);
    setVoiceId(template.voiceId);
    setAudioUrl(null);
    setAudioDurationSec(null);
    setCaptions([]);
    setTts({ status: "idle" });
    setLoadedTitle(null);
  };

  const scenes = useMemo(() => parseScenes(scenesText), [scenesText]);

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
      captionStyle,
      backgroundMedia: bgStatus.status === "ready"
        ? { type: "image", url: bgStatus.url, zoomTo: 1.08, dim: 0.45 }
        : null,
      musicUrl: null,
      musicDuck: 0.15,
    }),
    [
      hook,
      scenes,
      theme,
      lang,
      voiceId,
      audioUrl,
      audioDurationSec,
      captions,
      captionStyle,
      bgStatus,
    ],
  );

  const durationInFrames = useMemo(
    () => getShortDurationInFrames({ captions, audioDurationSec }),
    [captions, audioDurationSec],
  );

  /** حفظ الحالة بعدكل تغيير (debounce داخلي في hook). */
  usePersistEditor(
    {
      hook,
      scenesText,
      theme,
      captionStyle,
      voiceId,
      scriptSource,
      audioUrl,
      audioDurationSec,
      captions,
    },
    hydrated,
  );

  const { renderMedia, state, undo } = useRendering(SHORT_COMP_NAME, inputProps);

  /** يستدعي /api/script ويملأ الخطاف + المشاهد من الرد. */
  const generateScriptUI = async () => {
    setFormError(null);
    const src = scriptSource.trim();
    if (!src) {
      setFormError("أدخل رابط مقال أو موضوعاً أولاً");
      return;
    }
    setScriptLoading(true);
    try {
      const data = await requestScript({ source: src, isUrl: isUrlSource(src), lang });
      setHook(data.hook);
      setScenesText(scenesToText(data.scenes));
      // الصوت القديم لم يعد مطابقاً للنص الجديد — يلزم إعادة التوليد
      setTts({ status: "idle" });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setScriptLoading(false);
    }
  };

  /** يستدعي /api/image ويضبط الخلفية، مع مراعاة rate-limit وغياب المفتاح. */
  const generateBackground = async () => {
    setFormError(null);
    setBgStatus({ status: "loading" });
    try {
      const data = await requestBackground(hook || scenes[0]?.text || "خلفية");
      setBgStatus({ status: "ready", cached: data.cached, url: data.url });
    } catch (err) {
      setBgStatus({ status: "error", message: (err as Error).message });
    }
  };

  const generateAudio = async () => {
    setFormError(null);
    if (scenes.length === 0) {
      setFormError("أضف مشهداً واحداً على الأقل (سطر واحد = مشهد)");
      return;
    }
    setTts({ status: "loading" });
    try {
      const data = await requestNarration({ text: narrationText, voiceId });
      setAudioUrl(data.audioUrl);
      setAudioDurationSec(data.durationSec);
      setCaptions(data.captions);
      setTts({ status: "ready", cached: data.cached });
    } catch (err) {
      setTts({ status: "error", message: (err as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start" dir="rtl">
      {/* المحرر */}
      <InputContainer>
        {loadedTitle ? (
          <div className="text-xs opacity-70 mb-2">مشروع محمّل: {loadedTitle}</div>
        ) : null}
        <div className="flex flex-col gap-1 mb-3">
          <span className="text-sm font-medium" id="templates-label">قوالب جاهزة</span>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="templates-label">
            {SHORT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                title={template.description}
                onClick={() => applyTemplate(template)}
                className="rounded border px-3 py-1 text-xs hover:opacity-80"
                lang={template.lang}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="hook" className="text-sm font-medium">الخطاف (أول ثانيتين)</label>
          <input
            id="hook"
            value={hook}
            onChange={(e) => setHook(e.currentTarget.value)}
            maxLength={120}
            placeholder="عنوان يجذب الانتباه فوراً"
            className="leading-[1.7] block w-full rounded bg-background p-2 text-sm border"
          />
        </div>

        <Spacing />

        <div className="flex flex-col gap-1">
          <label htmlFor="scenes" className="text-sm font-medium">المشاهد (سطر = مشهد، حتى 12)</label>
          <textarea
            id="scenes"
            value={scenesText}
            onChange={(e) => setScenesText(e.currentTarget.value)}
            rows={5}
            placeholder={"سطر لكل مشهد\nمثال: العادة الصغيرة تهزم الحماس الكبير"}
            className="leading-[1.7] block w-full rounded bg-background p-2 text-sm border"
          />
          <div className="text-xs opacity-60">
            {scenes.length} مشاهد · {narrationText.length} حرف للتعليق
          </div>
          <div className="flex gap-2 items-center mt-1">
            <input
              id="script-source"
              aria-label="رابط مقال أو موضوع لتوليد سكربت"
              value={scriptSource}
              onChange={(e) => setScriptSource(e.currentTarget.value)}
              maxLength={500}
              placeholder="رابط مقال أو موضوع… (توليد سكربت AI)"
              className="leading-[1.7] block w-full rounded bg-background p-2 text-xs border"
            />
            <Button
              disabled={scriptLoading}
              loading={scriptLoading}
              onClick={generateScriptUI}
            >
              اقتراح سكربت
            </Button>
          </div>
        </div>

        <Spacing />

        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label htmlFor="theme" className="text-sm font-medium">الثيم</label>
            <select
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.currentTarget.value as ShortTheme)}
              className="rounded bg-background p-2 text-sm border"
            >
              {THEME_LABELS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label htmlFor="voice" className="text-sm font-medium">الصوت</label>
            <select
              id="voice"
              value={voiceId}
              onChange={(e) => setVoiceId(e.currentTarget.value)}
              className="rounded bg-background p-2 text-sm border"
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

        <div className="flex flex-col gap-1">
          <label htmlFor="caption-style" className="text-sm font-medium">أسلوب تحريك الكابشن</label>
          <select
            id="caption-style"
            value={captionStyle}
            onChange={(e) =>
              setCaptionStyle(e.currentTarget.value as CaptionStyle)
            }
            className="rounded bg-background p-2 text-sm border"
          >
            {CAPTION_STYLE_ORDER.map((id) => (
              <option key={id} value={id}>
                {CAPTION_STYLE_LABELS[id]}
              </option>
            ))}
          </select>
          <div className="text-xs opacity-60">
            يظهر الأثر بعد توليد الصوت، لأن التوقيت يعتمد على كلمات الصوت.
          </div>
          <div className="flex gap-2 items-center mt-1">
            {bgStatus.status === "ready" ? (
              <>
                <span className="text-xs opacity-70">
                  ✅ خلفية {bgStatus.cached ? "من الكاش" : "AI"} جاهزة
                </span>
                <Button
                  secondary
                  onClick={() => setBgStatus({ status: "idle" })}
                >
                  إزالة الخلفية
                </Button>
              </>
            ) : (
              <Button
                disabled={bgStatus.status === "loading"}
                loading={bgStatus.status === "loading"}
                onClick={generateBackground}
              >
                خلفية AI
              </Button>
            )}
          </div>
          {bgStatus.status === "error" ? (
            <div className="text-xs text-red-400 mt-1">{bgStatus.message}</div>
          ) : null}
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
            <div className="text-xs opacity-60 mt-2">
              {state.metrics
                ? state.cached
                  ? "من الكاش — نفس التكوين صُوّر قبلاً (بدون تكلفة تصيير)"
                  : state.metrics.estimatedCostUsd !== undefined
                  ? `تكلفة التصيير التقديرية: $${state.metrics.estimatedCostUsd.toFixed(4)} خلال ${state.metrics.sandboxWallSeconds} ثانية`
                  : `اكتمل التصيير خلال ${state.metrics.sandboxWallSeconds} ثانية`
                : null}
            </div>
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
      <div
        // مشغّل Remotion يُخرج المعاينة خارج إطارها داخل سياق RTL، فنعزله باتجاه LTR (النصوص داخل التكوين تضبط اتجاهها بنفسها)
        dir="ltr"
        className="mx-auto w-full max-w-[320px] shrink-0 overflow-hidden rounded-xl shadow-[0_0_200px_rgba(0,0,0,0.15)]"
      >
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

      {/* الحساب: المشاريع + السجل + الكريدت */}
      <div className="w-full lg:max-w-[360px] shrink-0">
        <AccountPanel currentProps={inputProps} onLoad={applyProject} />
      </div>
    </div>
  );
};
