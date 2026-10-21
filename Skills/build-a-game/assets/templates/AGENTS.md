# AGENTS.md: {{GAME_TITLE}}

**Template note:** the Three.js/browser/static-site details below are defaults for a new project on that path. For an existing project, fill in its actual engine, renderer and deployment model, then adapt or remove incompatible rules and tools; record the mapping and any skipped assurance in HANDOFF/TECH_PLAN. Do not migrate the project just to match this template.

{{ONE_PARAGRAPH_PITCH}} A {{CAMERA}} {{GENRE}} game built with {{ENGINE_AND_DEPLOYMENT}}. Playthrough: {{LENGTH}}. Input: {{INPUT}}.

This project is built with the `build-a-game` skill's 10-step pipeline, adapted to the engine and architecture recorded in `docs/TECH_PLAN.md` where needed. **Start here:** `docs/HANDOFF.md` (where we are and how to continue).

## Sources of truth (read before changing anything)

| File | What it is |
|---|---|
| `docs/HANDOFF.md` | Current step, decisions log, demo links, next steps |
| `docs/GAME_DESIGN.md` | Story, characters, mechanics, beat sheet, set pieces (approved {{DATE}}) |
| `docs/GAME_REQUIREMENTS.md` | The requirements baseline: scope, exclusions, acceptance criteria (recorded {{DATE}}). Only a **confirmed** line is user-approved and fixed until the user changes it |
| `docs/SCRIPT.md` | Every line in story order, with ✅ recorded / ⏳ not recorded / — not voiced. **Never re-record or edit a ✅ line's audio entry.** |
| `docs/DESIGN_SYSTEM.md` | The look: palette, materials, characters, motion, light, UI, budgets, acceptance checklist. Breaking it is a defect. *(step 3)* |
| `design/styles/{{CHOSEN_MOCKUP}}.html` | The design system's reference implementation. Port from it; don't reinvent it. *(step 3)* |
| `docs/TECH_PLAN.md` | Stack, architecture, quality gates, milestones *(step 6)* |
| `docs/LEVEL_LAYOUT.md` | Shared coordinates and named anchors *(step 6)* |
| `docs/BACKLOG.md` | Every playtest and review finding, with id and status |
| `.claude/agents/*.md` | The reviewers: critic, {{GENRE_DIRECTOR}}, narrative director *(step 6)* |

## Hard rules

1. **Files are the memory.** Update HANDOFF (and any doc you changed) after every step. For a project that doesn't use Three.js, adapt engine-specific rules and tools to its existing architecture; record reuse/adapt/skip decisions, evidence and limitations in HANDOFF rather than imposing incompatible defaults.
2. **Keep every demo working forever.** Mockups, the comparison page, the audition page, the talking-character demo and the frozen snapshots in `snapshots/` (never rebuilt or edited) are all listed in HANDOFF. "Clean-up" never touches them. If you change an API a demo uses, update the demo in the same change.
3. **For a new game on the Three.js path, visual assets are authored in code** (Three.js and GLSL), with no Blender or downloaded models. Existing projects keep their established asset pipeline unless the user explicitly approves a change.
4. **No clipping, floating or z-fighting.** Verify visual/geometry invariants numerically where the renderer and tooling support it; otherwise define an equivalent project-native check in `docs/TECH_PLAN.md`.
5. **Determinism for review.** The Three.js path exposes `window.LC` (see `tools/capture.mjs`). Existing projects use an equivalent debug/capture contract that fits their engine; document any unavailable check.
6. **Audio (optional route).** For a new project that chooses generated audio, keep runtime audio as static files; paid generations go through the cost-guarded tool, with a dry-run and explicit approval before every spend. Existing projects preserve their working audio architecture unless the user agrees to change it.
7. **No secrets in the client or chat.** For the optional ElevenLabs route, `ELEVENLABS_API_KEY` lives only in a gitignored `.env.local` and is read by build-time tools; never print it or ship it to the client. Existing integrations keep their established secure secret-management method.
8. **Performance budget** (for a compatible Three.js/browser project): target 60 fps at 1080p on physical mid-range laptop hardware; record the browser, OS, CPU/GPU, resolution, scenario and p95 frame time, with p95 ≤ 16.7 ms for the agreed run. Also check ≤ 150 draw calls, ≤ 150k triangles per view, ≤ 3 post passes, ≤ 2 shadow-casting lights and ≤ 6 real lights; instance anything repeated. SwiftShader/software-GPU is a separate conservative compatibility/budget check, not a physical-laptop performance result. If target-class hardware isn't available, mark that check `NOT RUN`/`BLOCKED`. For other engines, adapt these thresholds and checks to the actual renderer and record the rationale in `docs/TECH_PLAN.md`/HANDOFF; don't claim the Three.js-specific budget passed by proxy.
9. **Player clarity.** Every beat shows the **goal**, **where** to go, **how** to do it and **whether it's working**. Never ignore the player's input silently.
10. **Reviewed before the user sees it.** The critic reviews everything. The {{GENRE_DIRECTOR}} designs and reviews every set piece (it isn't done until `LANDS`). The narrative director reviews everything that carries story (it isn't done until `ON TRACK`). Fix BLOCKERs and MAJORs first. Every milestone gets a fresh-eyes playtest before the user plays.
11. **Never deploy or publish publicly without the user's explicit yes.** In autonomous mode, take the recommended option only within the user's explicit delegation, log it in HANDOFF as "assumed (autonomous)", and keep going; this does not authorize spending credits or publishing.
12. **A few long-lived helpers, one per domain**, not dozens of tiny ones. Every agent pays a start-up cost.
13. **Player progress is sacred.** The save schema is versioned, validated on load, round-trip tested, and a bad or missing file is refused with a message — it never erases other saves or silently resets progress.
14. **Protect Git state.** Check `git status` before staging or committing; preserve existing staged, unstaged and untracked work. Stage only files for the current game change, never commit unrelated or pre-existing work, and never run `git init` inside an existing repository. Merge required `.gitignore` entries instead of replacing an existing file.
15. **Verify changeable external facts.** Check official provider documentation for current pricing, licence/plan terms, service limits and CLI/API commands before relying on them. Record the source URL and check date in HANDOFF; examples in the skill are not a current guarantee.
16. **Evidence-based quality gates.** Record checks using `PASS`, `FAIL`, `NOT RUN`, `BLOCKED` or `INCONCLUSIVE`, with method, build/environment, and evidence in HANDOFF. Tests, manual play, simulations, browser automation and static inspection are different methods; never claim one ran when another did.
{{OPTIONAL_RULES}}
<!-- Add when relevant:
- Music-synced gameplay: analyse the real beats (beat map, < 15 ms), one audio clock, the song pauses with the game, verified in real time.
- Every voiced line is heard: at the player's position, speech clears everything else by ≥ 8 dB; beds duck under speech; measured by a check.
- Every character line is voiced (thoughts and hints too); only UI and readables are subtitle-only.
-->

## Visual debug workflow (Three.js path)

```bash
node tools/capture.mjs <page.html> --times 0,2.4,5 --views diorama,fp --out captures/<name> --selftest
```

This writes the frames, `_contact-sheet.png` and `report.json`. Look at the images: a scene isn't done until its frames look right and `selfTest` passes. Existing projects should use their adapted capture/test workflow from `docs/TECH_PLAN.md`; don't run this command unless the tool exists and fits.
