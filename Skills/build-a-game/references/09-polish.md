# Step 9: Polish

**Goal:** take the release candidate from "works" to "feels finished". That means the right length, smooth on an ordinary laptop, accessible, atmospheric, well mixed and clear from start to finish.

## Ask first

AskUserQuestion (multiSelect): **what bothers you most right now?** Mood and lighting / knowing what to do / smoothness and performance / sound mix / difficulty / something specific. Their answer sets the order. Everything below still gets checked.

## The polish pass

The draw-call/light/post-pass thresholds below are defaults for a compatible Three.js/browser renderer. In an existing project with another engine or render path, use its native profiler and equivalent renderer-specific budgets; record the chosen metrics and any unavailable check in HANDOFF. The physical target-device frame-time goal remains distinct from software-renderer checks.

- **Timing:** a bot plays start to finish. Estimate a first-time player's time (bots are faster, and LAST CALL's bot took about 25 minutes where a first-timer needs about 30). Compare it with the target from step 1, and trim or extend the slowest or emptiest beats.
- **Performance on an ordinary laptop:** measure representative gameplay on physical target-class hardware at 1080p, across the scenes and worst look angles. Record the baseline and before/after results in HANDOFF, including browser, OS, CPU/GPU, resolution, scenario and p95 frame time; the 60 fps target requires p95 frame time ≤ 16.7 ms for the agreed test run. Check draw calls, triangles, lights and post passes per view against the budget too. Run the software-GPU/SwiftShader capture separately as a conservative compatibility/budget check; it is not a substitute for physical hardware measurement. Never infer performance from a fast dev machine. If suitable hardware is unavailable, mark the hardware check `NOT RUN`/`BLOCKED`, not passed. Optimise only measured bottlenecks, don't spend polish time on budgets already cleared, and don't take a visual hit to gain frames you don't need — these thresholds are defaults for a compatible Three.js/browser project.
- **Accessibility:** each option must really work, with a capture or test per option:
  - subtitles (size, background, speaker names);
  - reduced intensity or scares, reduced flashing and photosensitivity-safe (no more than 3 full-frame brightness swings over 20% per second in any mode);
  - reduced motion;
  - control remapping (keyboard and gamepad);
  - colour-blind-safe cues;
  - for rhythm, an assist and latency calibration;
  - sensitivity, invert-Y and field of view.
- **Mood:** a focused lighting pass. LAST CALL kept its opening warm on purpose and made everything after a few warm pools of light in a cold, murky dark. It added a small reusable set of light cues (dim, flicker, frost) with flashing limits built in. Prove the goals stay findable by measuring each objective's contrast against its surroundings, before and after.
- **Clarity:** a fresh-eyes playtester that only reads the screen gets from start to finish without the chapter menu.
- **Mix:** rerun the dialogue-audibility check. Music, ambience and effects sit under speech everywhere.
- **Final reviews:** the critic, the genre director and the narrative director (a full-story read in order), then the user plays the final build.

Freeze the polished build as a new snapshot (`snapshots/<milestone>/`), add it to the demos, and update HANDOFF.

**Done when:** the reviewers pass it, the user signs off, and the snapshot is frozen. Next: step 10, deploy.
