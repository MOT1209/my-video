import { Composition } from "remotion";
import {
  COMP_NAME,
  defaultMyCompProps,
  DURATION_IN_FRAMES,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../../types/constants";
import {
  defaultShortProps,
  getShortDurationInFrames,
  SHORT_COMP_NAME,
  SHORT_FPS,
  SHORT_HEIGHT,
  SHORT_WIDTH,
  type ShortProps,
} from "../../types/shorts";
import { Main } from "./MyComp/Main";
import { NextLogo } from "./MyComp/NextLogo";
import { ShortMain } from "./Shorts/ShortMain";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMP_NAME}
        component={Main}
        durationInFrames={DURATION_IN_FRAMES}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultMyCompProps}
      />
      <Composition
        id="NextLogo"
        component={NextLogo}
        durationInFrames={300}
        fps={30}
        width={140}
        height={140}
        defaultProps={{
          outProgress: 0,
        }}
      />
      <Composition
        id={SHORT_COMP_NAME}
        component={ShortMain}
        durationInFrames={450}
        fps={SHORT_FPS}
        width={SHORT_WIDTH}
        height={SHORT_HEIGHT}
        defaultProps={defaultShortProps}
        calculateMetadata={({ props }: { props: ShortProps }) => {
          return {
            durationInFrames: getShortDurationInFrames({
              captions: props.captions ?? [],
              audioDurationSec: props.audioDurationSec ?? null,
            }),
          };
        }}
      />
    </>
  );
};
