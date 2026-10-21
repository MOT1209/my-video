# Step 6: The vertical slice (and the team)

**Goal:** plan how the whole game will be built, bring in the team, then build **one short, fully playable, polished section** (about 5 minutes) that uses almost every system: movement, the signature mechanic, a set piece (e.g. a scare), characters talking, music and sound, and the menus.

**Why it matters:** documents and mockups only tell you so much. One short play session of LAST CALL's slice surfaced seven problems that every document, mockup, review and test had missed. Finding them in 5 minutes of game is cheap. Finding them after building 30 minutes is not.

## Ask first

AskUserQuestion:
- **Which 5 minutes:** offer 2–3 stretches from the beat sheet. Recommend the one that touches the most systems, including the signature mechanic, a set piece and dialogue. (LAST CALL's: wake up in the restroom → the empty bar → pick up the drumsticks → the mechanic's first use → the realisation → the first scare → a mysterious phone call.)
- **How thorough the reviews are:** thorough (the reviewers each look separately, recommended if the user has plenty of usage) / lean (one combined reviewer, fewer screenshots, recommended if they're near their usage limit). Explain that this trades review depth for cost.
- **Tech stack (new projects only):** TypeScript + Vite + Three.js, built as a static site that any web host can serve (Recommended; the host is picked in step 10) / another stack the user prefers. For an existing project, inspect and keep its established stack; ask only about unresolved choices that materially affect the plan.

## Architecture review first

The tech plan must fit what's actually in the project, so inspect before writing it: the engine and its version (locked in the plan), the directory structure, the main game loop, scene and state management, input handling, any entity/component structure, physics and collision, asset loading, audio management, persistence and saves, UI architecture, testing infrastructure, and the build/deploy config. On a new game those are blank choices; on a project with existing code, the review decides what's reused and what's missing.

Rules for the review and the plan it feeds:
- **Follow the existing architecture unless there's a demonstrated reason not to.** Name the reason, the alternatives considered, and the migration or compatibility risk before changing anything big, and record that in `docs/TECH_PLAN.md` (the project's architecture-decisions record; never silently reorganise a working structure).
- **No unnecessary rewrites, no premature abstraction** — build the simplest thing the slice needs, and generalise later if a second use appears.
- **One-way dependencies:** gameplay logic doesn't import rendering directly; systems and scenes stay separate so reviewers and tests can reason about each.
- **One system per job** — no duplicate clocks, loaders, audio paths or input handlers; the registry pattern from the add-a-file structure below is what prevents spread.

## Plan first

Write these before any game code, so parallel helpers build things that fit together. Treat the Three.js/Vite examples below as defaults for a compatible new project; in an existing project, preserve its engine and architecture and translate the artifacts/checks to equivalent project-native forms, documenting any limitation rather than creating duplicate systems:

- **`docs/TECH_PLAN.md`:**
  - the stack and any reuse/adapt/skip decisions for the 10 pipeline steps (with reason, equivalent evidence/output and any lost assurance);
  - the source layout;
  - the key systems, adapted to the chosen engine and actual game scope: one game clock (the audio clock for anything rhythmic), mood states of the world, rooms and culling, collision (a capsule against a simplified collision mesh, with no physics engine needed), characters (one rig builder with per-character data), audio buses with dialogue ducking, a narrative beat graph (each beat has enter conditions, objectives and checkpoints), and accessibility;
  - the **save schema**: versioned, each field with a default, validated on load (a missing field fills its default; corrupt or unreadable data is refused loudly with a message, and **never wipes the other saves**); a save → load → compare **round-trip test** in the slice's suite from the start; and a note that future updates must keep old saves loading (fix by version check and data migration, tested in the checkpoint suite);
  - the quality gates for each milestone (below);
  - milestones (M0 foundation, M1 the slice, one milestone per act, a polish milestone, and deploy);
  - the slice's exact scope;
  - the audio budget against the credit ceiling.
- **`docs/LEVEL_LAYOUT.md`:** a shared map with real coordinates (metres) and **named anchor points** (door positions, the player's start, where each character stands). Every helper builds against the same numbers.
- **Add-a-file structure:** a new character, room, system or act is a **new file** that gets discovered automatically (e.g. Vite's `import.meta.glob` over `src/characters/cast/*.ts`). Nobody edits a shared list, so parallel helpers don't collide.

## The game's debug API

For a project on the compatible Three.js path, the game gets the same `window.LC` contract as the mockups, plus:
- `goto(beat)`: jump to any beat with the correct inventory and world state;
- `camera(pos, look)`;
- `state()`;
- a `selfTest` covering collision (the player can't get inside geometry), contacts, budgets and the registries.

For another engine, adapt the debug API and capture tooling to the existing test/render architecture; define equivalent deterministic jump, state and self-test capabilities where feasible, and record any missing assurance rather than retrofitting an incompatible `window.LC` contract.

For the Three.js path, extend `tools/capture.mjs` to build or serve the game and run **scenarios** (named beats and views), grouped into suites per area. For another engine, extend or reuse its existing capture/test harness and map equivalent scenarios to the same quality gates.

## Bring in the team

Read `references/team.md`. Create the three reviewer agents in the user's `.claude/agents/` from `assets/templates/agents/`, filled in with *this* game's concept, story rules, characters and genre. Then run the build as a small pipeline of **a few big helpers**:

1. **Foundation:** the engine, the style module ported from the reference mockup, collision, input (keyboard, mouse and gamepad), save/checkpoints, the debug API and capture scenarios.
2. **In parallel, once the foundation lands:**
   - **audio** (wiring the recorded files into buses, spatial sound and ducking);
   - **world** (the slice's rooms, lighting and set dressing);
   - **characters** (everyone in the slice, built on the lip-sync demo's rig).
3. **Gameplay:** the signature mechanic, the set piece, dialogue and subtitles, objectives and UI, tying it all into the beat graph.
4. **Review → fix → verify:** the critic, the genre director (for the set piece) and the narrative director (for every line, clue and beat) review from real captures. Fix every BLOCKER and MAJOR, then check again.
5. **Fresh-eyes playtest:** a helper plays the slice knowing only what's on screen, and must finish it. Fix every moment it got stuck.

**Build player clarity in from the start** (ground rule 8). Each beat needs:
- an objective the player can see;
- a pull toward where to go (light, sound or a character);
- a one-time how-to card the first time a mechanic is needed, with keyboard *and* gamepad controls;
- immediate feedback for success *and* failure.

Also a **title screen with Continue and New game**, and a pause menu with **Restart**. LAST CALL's first playtest had none of these, and they all became fixes.

## Quality gates (every milestone, starting here)

1. The project's production build passes; static type checking also passes where the stack provides it.
2. The project's capture/test suite passes the applicable project-native scene-integrity and renderer-budget checks, checks console/runtime errors where applicable, and captures every mood state.
3. The reviewers have no open BLOCKER or MAJOR findings. The genre director says the set piece **lands**, and the narrative director says the story is **on track**.
4. For a Three.js project, check draw-call/triangle/light budgets in the capture suite; for another engine, check the renderer-specific budgets in `TECH_PLAN.md`. For either path, measure representative gameplay frame time on physical target-class hardware (browser/runtime, OS, CPU/GPU, resolution, scenario and p95 frame time recorded; the 60 fps target requires p95 ≤ 16.7 ms for the agreed test run unless a different target was explicitly agreed). Run software-GPU/SwiftShader separately as a conservative compatibility/budget check, not as a proxy for a physical laptop. If suitable hardware is unavailable, record the performance check as `NOT RUN`/`BLOCKED`; do not claim the target passed.
5. The save/load round trip passes: a saved slice resumes at the same beat with the same state, and a corrupted or missing save file is handled safely (refused with a message, nothing erased).
6. The fresh-eyes playtester completes it.
7. **Then** the user plays (step 7).

**Done when:** all seven gates pass or are explicitly marked `NOT RUN`/`BLOCKED` without falsely claiming completion; required acceptance gates must pass before the milestone is called done. Give the user the link (start the dev server using the project's documented command), the controls, and how long it takes. Next: step 7, where they play it.
