# {{GAME_TITLE}}: requirements (recorded {{DATE}})

The one-page contract for what the game must deliver. Written at the end of the step-1 interview, before any major implementation. Later steps check work against this file first; only a decision recorded here as **confirmed** is user-approved and fixed until the user changes it.

## 1. How to read the **kind** column

| Kind | Meaning |
|---|---|
| **confirmed** | The user explicitly chose or approved it in chat or in a decision this doc points to. Only the user may change it. |
| **assumed** | Nobody explicitly decided it; it was inferred. Keep it open to revision and surface it again if it affects a major build. |
| **assumed (autonomous)** | The user explicitly delegated the decision (e.g. "you decide") and the agent chose it. Log it as autonomous; it is not user-confirmed and remains revisable. |
| **recommended** | A proposed default with its trade-off explained. It is not accepted or binding until the user explicitly chooses or approves it; while pending, keep it under open questions. |

Keep the doc honest: silence, lack of objection, or moving to the next step does not mean approval. When the user explicitly accepts a recommendation, update its kind to **confirmed** and record the date and decision in HANDOFF. Don't silently rewrite history.

## 2. Requirements

| Area | Requirement | Kind |
|---|---|---|
| Game concept | {{One line: what the game is, its tone, its theme}} | |
| Core gameplay loop | {{What the player does minute to minute, including the signature mechanic}} | |
| Target platform | {{Browser (which engines/browsers), desktop sizes, touch or not}} | |
| Engine & tech constraints | {{Existing project's engine and version, or (for a new Three.js-path game) Three.js + TypeScript + Vite, static site; anything pinned or forbidden}} | |
| Required gameplay systems | {{The systems the first playable version really needs (e.g. movement, interaction, save/continue, dialogue). Systems NOT in this list are out of scope}} | |
| Visual & audio direction | {{Chosen art direction (or "mockup in step 3"), audio route (voiced / subtitles-only), music}} | |
| First playable scope | {{Stretch of the beat sheet that forms the vertical slice, and its target length}} | |
| Performance target | {{For Three.js projects, ground-rule budgets plus a 60 fps target measured on recorded physical reference hardware (p95 frame time ≤ 16.7 ms for the agreed run); for another engine, the measured equivalent and reference hardware. Distinguish physical-device results from software-renderer checks.}} | |
| Testing requirements | {{What "playable and correct" means: capture suites, selfTest, fresh-eyes playtest, the user's own playtest}} | |
| Explicit exclusions | {{What this game deliberately does NOT have (e.g. multiplayer, cloud saves, achievements)}} | |
| Known risks | {{The 2-4 biggest things that could make this fail or shrink (buildability, cost, scope creep)}} | |

## 3. Acceptance criteria

The first playable version is accepted when all of these pass:

- [ ] {{Criterion 1, e.g. a fresh-eyes player finishes the slice without help}}
- [ ] {{Criterion 2}}
- [ ] {{Criterion 3}}
- [ ] Renderer budgets pass their capture checks, and the agreed physical-hardware gameplay performance target is measured and passes (software-renderer results do not substitute)
- [ ] Zero known BLOCKER or MAJOR findings left open at scope-off

## 4. Open questions carried forward

- {{Uncertainty (if any) deferred until the relevant step decides it — never let something silently become assumed}}

*(This file is created in step 1 from this template's structure, not copied verbatim. It is not a design doc: GAME_DESIGN.md says **how the game wants to be**; this file records **what the user has explicitly confirmed**, plus clearly labelled assumptions and pending recommendations. When the two disagree, the user's confirmed agreement wins.)*
