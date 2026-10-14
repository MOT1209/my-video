import { describe, expect, test } from "bun:test";
import {
  buildNarrationText,
  distributeCaptionsEvenly,
  getShortDurationInFrames,
  SHORT_FPS,
} from "./shorts";

describe("buildNarrationText", () => {
  test("joins hook and scenes with '. '", () => {
    expect(
      buildNarrationText({
        hook: "عنوان",
        scenes: [
          { id: "s1", text: "مشهد أول", imageUrl: null },
          { id: "s2", text: "مشهد ثان", imageUrl: null },
        ],
      }),
    ).toBe("عنوان. مشهد أول. مشهد ثان");
  });
});

describe("distributeCaptionsEvenly", () => {
  test("splits duration equally across words", () => {
    expect(distributeCaptionsEvenly("a b c", 6)).toEqual([
      { word: "a", start: 0, end: 2 },
      { word: "b", start: 2, end: 4 },
      { word: "c", start: 4, end: 6 },
    ]);
  });

  test("returns [] for empty text or duration", () => {
    expect(distributeCaptionsEvenly("", 6)).toEqual([]);
    expect(distributeCaptionsEvenly("a b", 0)).toEqual([]);
  });
});

describe("getShortDurationInFrames", () => {
  test("uses last caption end + 1s tail", () => {
    expect(
      getShortDurationInFrames({ captions: [], audioDurationSec: 10 }),
    ).toBe(Math.round(11 * SHORT_FPS));
  });

  test("caps at 60 seconds", () => {
    expect(
      getShortDurationInFrames({ captions: [], audioDurationSec: 59.5 }),
    ).toBe(60 * SHORT_FPS);
  });

  test("minimum 3s + tail when empty", () => {
    expect(getShortDurationInFrames({ captions: [], audioDurationSec: null })).toBe(
      Math.round(4 * SHORT_FPS),
    );
  });
});
