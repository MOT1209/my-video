import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ShortProps, ShortTheme } from "../../../types/shorts";
import { ShortBackground } from "./Background";
import { HookTitle } from "./HookTitle";
import { SceneCard, ShortProgress } from "./SceneCard";
import { WordCaptions } from "./WordCaptions";
import "./font";

const ACCENTS: Record<ShortTheme, string> = {
  dark: "#a78bfa",
  paper: "#f59e0b",
  neon: "#22d3ee",
  news: "#f87171",
  quotes: "#e879f9",
};

const HOOK_FRAMES = 75;

export const ShortMain: React.FC<ShortProps> = ({
  hook,
  scenes,
  theme,
  lang,
  audioUrl,
  captions,
  musicUrl,
  musicDuck,
}) => {
  return (
    <AbsoluteFill>
      <ShortBackground theme={theme} />

      {/* عنوان الخطاف: أول 2.5 ثانية */}
      <Sequence durationInFrames={HOOK_FRAMES}>
        <HookTitle hook={hook} lang={lang} />
      </Sequence>

      {/* بطاقة المشهد النشط حسب التوقيت */}
      <ActiveSceneCard
        scenes={scenes.map((s) => ({ text: s.text }))}
        lang={lang}
      />

      {/* الكابشن كلمة-كلمة */}
      <WordCaptions captions={captions} lang={lang} accent={ACCENTS[theme]} />

      {/* الصوت */}
      {audioUrl ? <Audio src={audioUrl} /> : null}
      {musicUrl ? <Audio src={musicUrl} volume={musicDuck} loop /> : null}

      <ShortProgress />
    </AbsoluteFill>
  );
};

/** يختار المشهد النشط بتقسيم المدة بالتساوي */
const ActiveSceneCard: React.FC<{
  scenes: { text: string }[];
  lang: "ar" | "en";
}> = ({ scenes, lang }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (scenes.length === 0) {
    return null;
  }
  const per = durationInFrames / scenes.length;
  const idx = Math.min(scenes.length - 1, Math.floor(frame / per));
  return (
    <SceneCard text={scenes[idx].text} lang={lang} index={idx} total={scenes.length} />
  );
};
