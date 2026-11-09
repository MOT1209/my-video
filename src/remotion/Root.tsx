import { Composition } from "remotion";
import {
  defaultShortProps,
  getShortDurationInFrames,
  SHORT_COMP_NAME,
  SHORT_FPS,
  SHORT_HEIGHT,
  SHORT_WIDTH,
  type ShortProps,
} from "../../types/shorts";
import { ShortMain } from "./Shorts/ShortMain";

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
