# Skill audit: `build-a-game`

Baseline audit performed 2026-10-21, before the reliability/testing/production-readiness enhancements. Every claim below was checked against the files on disk; nothing is assumed from earlier proposals.

## 1. What this skill is

- **Location:** `Skills/build-a-game/` (untracked by the surrounding git repo; a rollback copy was made at `Skills/.build-a-game-backup-2026-10-21/` before any edit).
- **Format:** standard agent-skill layout — one `SKILL.md` with YAML frontmatter (`name`, `description`), plus reference files loaded per-step and templates copied into the user's project.
  - `SKILL.md` (the workflow: 10 steps, ask-don't-guess protocol, ground rules, team summary)
  - `references/01-concept.md` … `10-deploy.md`, `references/team.md`
  - `assets/templates/`: `AGENTS.md`, `HANDOFF.md`, `SCRIPT.md`, `BACKLOG.md`, `agents/{game-critic,genre-director,narrative-director}.md`
- **Activation mechanism:** the frontmatter `description` (skills are matched by description text). First line of the body is the H1. No other metadata is required by the format.
- **Target workflow:** Three.js browser games (TypeScript + Vite static sites), built end-to-end in a Claude-Code-style agent session, deployed to a static host.

## 2. Current capabilities (verified present)

| Capability | Where it lives |
|---|---|
| 10-step pipeline with per-step outputs, done-when and reference pointers | `SKILL.md` table; each `references/0N-*.md` ends in **Done when** |
| Clarifying-questions protocol (rounded interviews, recommendations first, no padding, autonomous-mode logging) | `SKILL.md` "Ask, don't guess" |
| Session resume via project memory | `SKILL.md` "Start or resume"; `HANDOFF`/`AGENTS` templates |
| Visual debugging tool contract (`window.LC`, capture tool, selfTest, planted-error proof) | `references/02-visual-debugging.md` |
| Design system + acceptance checklist (contacts, budget, contrast, photosensitivity) | `references/03-art-style.md` |
| Cost-guarded paid generation (manifest, dry-run, credit caps, hash cache, ledger) | `references/04-voices.md` |
| Reviewer agents with verdicts and ranked findings | `references/team.md`, `assets/templates/agents/*` |
| Quality gates (build, captures, reviews, budget, playtest) | `references/06-vertical-slice.md` |
| Playtest loop that converts feelings into root causes and rules | `references/07-playtest.md` |
| Bot playthrough, frozen snapshots, batch recording | `references/08-full-build.md` |
| Polish pass (timing, software-GPU budget, accessibility) | `references/09-polish.md` |
| Deploy host guidance, secrets check, path-base check, cache headers | `references/10-deploy.md` |
| Secrets hygiene (`.env.local` gitignored, key never printed) | `SKILL.md` ground rules 6; `04-voices.md`; `10-deploy.md` |
| Fresh-eyes playtester protocol | `references/team.md` |

## 3. Gaps (what the enhancement pass adds)

1. **Requirements discovery is implicit.** Questions are asked, but there is no requirements artifact that separates *confirmed by the user* from *assumed* or *recommended default*, and no explicit approval gate before a major build. → new `assets/templates/GAME_REQUIREMENTS.md`, wired into step 1 and the ask-protocol.
2. **Stage completion is under-specified.** "Done when" exists per step, but nothing forbids marking a stage complete merely because files were created, nor requires recording what was actually verified. → new ground rule in `SKILL.md`.
3. **No architecture review step.** Step 6 writes a tech plan from scratch; an existing project's engine, structure and conventions are never formally inspected before planning, and nothing forbids unnecessary rewrites or engine migration. → new "Architecture review" section in `06-vertical-slice.md` + existing-project detection in `SKILL.md`.
4. **Bug records are thin.** `BACKLOG.md` tracks id/words/status only — no severity, environment, repro, expected/actual, root cause, regression test or verification evidence. → reworked `BACKLOG.md` template; `07-playtest.md` updated.
5. **No visual baselines.** Captures are reproducible, but there is no procedure for comparing a changed scene against agreed golden frames, nor guidance on tolerating non-determinism. → new section in `02-visual-debugging.md`.
6. **Performance method is budget-checking only.** No measure-before/measure-after baseline protocol, no documentation of test environment. → addition in `09-polish.md`.
7. **Save integrity unspecified.** Saves/checkpoints appear in the step-6 system list with no schema, validation, round-trip or corruption-handling requirements. → additions in `06-vertical-slice.md`, `08-full-build.md`, and a hard rule in the `AGENTS.md` template.
8. **No asset/license provenance.** Nothing records voice licensing terms or asset provenance; paid-API plan rights are unchecked. → addition in `04-voices.md`.
9. **Multi-agent honesty rule missing.** Nothing forbids claiming an independent review or playtest happened when it didn't, or that review ran sequentially by the same agent. → addition in `references/team.md`.
10. **Release states are conflated.** Step 10 checks the live site, but the intermediate states (source complete / local build / runtime verified / production build / preview / deployed / live verified) are not named anywhere, and the HANDOFF template can't record them. → new section in `10-deploy.md` + a field in the HANDOFF template.
11. **Platform detection absent.** The skill assumes Three.js whatever is in the folder. → new clause in "Start or resume".

## 4. Conflicts and duplicates found

- **No hard conflicts found.** The per-step "Ask first" lists and the global "Ask, don't guess" protocol overlap by design (protocol vs. step content).
- **Minor duplication:** determinism is stated in `02-visual-debugging.md` and as ground rule 4; acceptable (rule + how-to).
- **Minor inconsistency:** step 9 budgets and ground rule 7 state the same numbers in two places — kept consistent deliberately (budget must not drift).
- **Stale references:** none. All paths cited in `SKILL.md` and the references exist (verified by path check; see §7).

## 5. Compatibility risks

- Skill frontmatter must stay two keys (`name`, `description`) with the description first in the file — all edits preserve this.
- The 10-step table is the resume contract (`HANDOFF` references its row numbers); its step numbering must not change.
- Templates are copied into user projects mid-flow; new template fields must default gracefully (they do — added fields are filled in step 1 / step 10).
- The surrounding git repo is unrelated and busy; all edits stay inside `Skills/build-a-game/`.

## 6. Files modified by the enhancement pass

- `SKILL.md` — interview protocol + honesty ground rule + existing-project detection + step-1 outputs
- `references/01-concept.md` — `docs/GAME_REQUIREMENTS.md` step
- `references/02-visual-debugging.md` — visual baselines section
- `references/04-voices.md` — voice licensing / provenance
- `references/06-vertical-slice.md` — architecture review, save schema, extra gate
- `references/07-playtest.md` — bug record requirements
- `references/08-full-build.md` — save round trips in the release pass
- `references/09-polish.md` — measure-before/after performance protocol
- `references/10-deploy.md` — release-state vocabulary
- `references/team.md` — review-honesty rule
- `assets/templates/GAME_REQUIREMENTS.md` — **new**
- `assets/templates/AGENTS.md` — requirements doc row + save-integrity hard rule
- `assets/templates/HANDOFF.md` — release-state field
- `assets/templates/BACKLOG.md` — bug record format
- `docs/SKILL_AUDIT.md` — this file (**new**)

## 7. Validation available in this environment

- Bash + git (status, diff review); Node is present in the environment but no build system targets skill files (documentation-only change).
- Checks actually run: directory-structure listing, referenced-path existence check, frontmatter structure check, duplicate/conflict scan (grep), git diff review. Results are recorded in the final completion report — anything not runnable is reported as NOT RUN there, not here.

## 8. Follow-up review: resolved findings (2026-10-21)

The follow-up review identified and addressed these issues without changing the 10-step pipeline or its numbering:

- Performance: SwiftShader is now explicitly a compatibility/budget check, not a physical-device performance proxy. The 60 fps target is measured during representative gameplay on target-class hardware, with p95 frame time and environment recorded; unavailable hardware is `NOT RUN`/`BLOCKED`, not a pass.
- Decision provenance: only explicit user choices are `confirmed`; recommendations remain pending until explicitly accepted. Delegated choices are logged as `assumed (autonomous)`.
- Existing projects: steps and Three.js-specific tools are mapped to reuse/adapt/skip, with equivalent checks and lost assurance recorded. Existing engine, assets, audio, and deployment architecture are preserved unless the user approves a material change.
- Git safety: check repository/status before initialization or staging, never initialize inside an existing repository, preserve existing work, stage only task files, and merge `.gitignore` entries instead of replacing existing rules.
- External facts: provider pricing, terms/licences, limits, and commands are treated as time-sensitive; official sources and check dates have a place in HANDOFF.

Validation limitation for this follow-up: the terminal command broker could not start Git Bash (`ENOENT` for `C:\\Program Files\\Git\\bin\\bash.exe`), so post-edit shell-based checks and `git diff --check` were not run. The edited Markdown was inspected through file reads and repository text searches; no build/test command applies to this documentation-only change.
