"use client";

import { Player } from "@remotion/player";
import type { NextPage } from "next";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  CompositionProps,
  defaultMyCompProps,
  DURATION_IN_FRAMES,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../../types/constants";
import { RenderControls } from "../components/RenderControls";
import { ShortsEditor } from "../components/ShortsEditor";
import { Tips } from "../components/Tips";
import { Main } from "../remotion/MyComp/Main";

const Home: NextPage = () => {
  const [tab, setTab] = useState<"shorts" | "classic">("shorts");
  const [text, setText] = useState<string>(defaultMyCompProps.title);

  const inputProps: z.infer<typeof CompositionProps> = useMemo(() => {
    return {
      title: text,
    };
  }, [text]);

  return (
    <div>
      <div className="max-w-screen-md m-auto mb-5 px-4 mt-16 flex flex-col gap-10">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("shorts")}
            className={`px-4 h-10 rounded text-sm font-medium border transition-colors ${
              tab === "shorts" ? "bg-foreground text-background" : "opacity-60"
            }`}
          >
            Shorts عمودي 9:16
          </button>
          <button
            onClick={() => setTab("classic")}
            className={`px-4 h-10 rounded text-sm font-medium border transition-colors ${
              tab === "classic" ? "bg-foreground text-background" : "opacity-60"
            }`}
          >
            Classic أفقي
          </button>
        </div>

        {tab === "shorts" ? (
          <ShortsEditor />
        ) : (
          <>
            <div className="overflow-hidden rounded-geist shadow-[0_0_200px_rgba(0,0,0,0.15)]">
              <Player
                component={Main}
                inputProps={inputProps}
                durationInFrames={DURATION_IN_FRAMES}
                fps={VIDEO_FPS}
                compositionHeight={VIDEO_HEIGHT}
                compositionWidth={VIDEO_WIDTH}
                style={{
                  width: "100%",
                }}
                controls
                autoPlay
                loop
                initiallyMuted
              />
            </div>
            <section className="flex flex-col gap-4">
              <RenderControls
                text={text}
                setText={setText}
                inputProps={inputProps}
              ></RenderControls>
            </section>
          </>
        )}
        <Tips></Tips>
      </div>
    </div>
  );
};

export default Home;
