# Phase 2 audit — `build-a-game`

**Audit date:** 2026-10-21
**Scope:** the installed skill directory and the available Agent Browser skill stub.
**Status:** baseline inspection completed before Phase 2 edits.

## 1. Located installation and activation

- **Installed skill:** `Skills/build-a-game/` (this directory).
- **Recovery copy present:** sibling directory `Skills/.build-a-game-backup-2026-10-21/`. It was already present before this Phase 2 work; this audit does not claim to have created or modified it.
- **Activation format verified:** `SKILL.md` starts with YAML frontmatter containing `name: build-a-game` and `description:`, followed by `# Build a game`. Keep this metadata shape and the description-driven activation intact.
- **Repository context:** the skill directory is nested under a surrounding Git project, but Git state/remote could not be inspected because the terminal broker failed to spawn Git Bash (`ENOENT`). No Git initialization, staging, commit, push, or remote operation was performed.

## 2. Inspected current files

- Complete `SKILL.md`.
- All 11 reference files: `references/01-concept.md` through `references/10-deploy.md`, plus `references/team.md`.
- All five top-level templates and the three reviewer-agent templates under `assets/templates/`.
- Existing audit `docs/SKILL_AUDIT.md`, including its baseline and follow-up review notes.
- Directory listings for the installation, references, templates, docs, and sibling skill directory.

No separate Phase 1 change log, handoff report, validation report, runtime scripts, or configuration files were found under this skill's `docs/`, `references/`, or `assets/` directories. The sibling backup exists, but its contents were not used as a second implementation source.

## 3. Verified existing capabilities — reuse, do not duplicate

| Capability | Evidence in current skill | Phase 2 implication |
|---|---|---|
| Ten-stage workflow and conditional step-specific reading | `SKILL.md` 10-row pipeline and per-step references | Preserve numbering and existing step contracts. |
| Requirements interview and decision provenance | `SKILL.md` “Ask, don't guess”; `01-concept.md`; `GAME_REQUIREMENTS.md` template | Reuse the existing interview and confirmed/assumed/recommended vocabulary. |
| Existing-project architecture inspection | `SKILL.md` “Start or resume”; `06-vertical-slice.md` architecture review | Extend engine-aware behavior; do not create a second architecture-review workflow. |
| Test/build/capture gates and truthful reporting | `06-vertical-slice.md`; `08-full-build.md`; `team.md`; `AGENTS.md` template | Add a common evidence vocabulary and regression scope without replacing these gates. |
| Fresh-eyes player testing | `team.md`; steps 6–9 | Refine into scenario-based AI playtesting; do not call a reviewer a playtester. |
| Visual regression baselines | `02-visual-debugging.md` golden-frame procedure | Extend to runtime/gameplay regressions, not duplicate image baselines. |
| Performance measurement | `SKILL.md` ground rule 7; steps 6 and 9 | Preserve physical-device p95 test and distinguish it from SwiftShader. |
| Save integrity and release verification | `06-vertical-slice.md`; `08-full-build.md`; `10-deploy.md`; templates | Link to versioning/release guidance rather than creating a competing release checklist. |
| Persistent project memory | `HANDOFF.md` and `AGENTS.md` templates, updated each step | Keep these as the single project-state source of truth. |
| Asset provenance and license checks | `04-voices.md` and external-facts table in HANDOFF | Generalize carefully to imported/generated assets. |
| Git safety | `SKILL.md`, `01-concept.md`, `AGENTS.md` template | No Git mutation in this phase; preserve existing user state. |

## 4. Verified gaps and risks

1. **P0 workflows are scattered:** the skill has tests and a fresh-eyes tester but no explicit baseline → change → affected-regression → compare → classify process, nor a structured playable-scenario report contract.
2. **Tool discovery is implicit:** capture/browser/native engine/testing capability is assumed at several steps; no single narrow toolkit inventory/fallback workflow exists.
3. **Specialized engineering guidance is absent:** procedural world/assets, NPC AI, game-feel, dependency tracing, analytics, multiplayer, and cross-platform checks are not modularly described.
4. **Release concepts are present but lack a standalone version/channel workflow:** `HANDOFF` has release states, while the production candidate workflow lives in step 8/10. Extend those rather than create a separate project memory system.
5. **Agent Browser product source is not present in this skill tree.** A globally available `agent-browser` skill stub describes a CLI and says to fetch version-matched instructions with `agent-browser skills get core`; its claimed features are not proof that the CLI is installed or that the user's independently developed browser has those APIs. Terminal is unavailable, so no CLI command, browser operation, screenshot, log, or integration capability was executed. Do not invent an API or conflate the globally available stub with the user's product.
6. **Validation infrastructure is absent here:** no scripts or test configuration were found in the skill directory. Documentation checks may be performed using repository search/file reads; shell checks, Git checks, and runtime/playtest claims remain blocked unless terminal/tool access becomes available.
7. **Conditionality is essential:** mandatory multiplayer, analytics, procedural generation, LLM/NPC services, or platform promises would expand scope/cost and violate the current director-led workflow.
8. **The directory is outside the current terminal's verified write boundary for Git operations:** preserve the recovery sibling and all existing project state; do not package unrelated files or secrets.

## 5. Implementation priorities

- **P0:** regression guardian, AI playtester, game developer toolkit, shared quality/evidence contract.
- **P1:** game intelligence, procedural world generation, procedural asset studio, advanced NPC AI, game-feel engineering, asset dependency graph.
- **P2:** analytics, multiplayer architecture, cross-platform compatibility, versioning/release channels, persistent memory (integrate into existing HANDOFF/AGENTS), Agent Browser adapter (only verified capabilities; otherwise a capability contract and safe fallback).

All new workflows must be loaded only when relevant to the game/task and existing capabilities. Each module must distinguish documented guidance from operations actually available in the target project. Preserve the original ten pipeline steps and require user approval for material scope, cost, privacy, or publishing decisions.

## 6. Phase 2 validation plan

- Check frontmatter shape/name and preserve the 10 pipeline rows.
- Check all new module links exist and conditional-selection instructions exist.
- Search for duplicated or contradictory test, approval, Agent Browser, and release rules.
- Inspect final changed files and report exactly what was verified.
- Do not claim tests, browser automation, runtime behavior, or Git cleanliness without executed evidence.

**Known validation blocker:** terminal commands currently fail before execution because the configured Git Bash path is missing (`C:\Program Files\Git\bin\bash.exe`). Record any shell-based check as `NOT RUN` unless execution becomes available.
