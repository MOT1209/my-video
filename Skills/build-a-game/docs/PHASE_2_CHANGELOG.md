# Phase 2 change log — `build-a-game`

Date: 2026-10-21

## Added

- `references/game-quality-contract.md` — shared evidence statuses and gate semantics.
- `references/game-regression-guardian.md` — baseline/affected-test/regression workflow.
- `references/ai-playtester.md` — scenario-based gameplay testing and report fields.
- `references/game-developer-toolkit.md` — capability discovery, minimal tooling, and fallback.
- `references/game-intelligence.md` — conditional design trade-off review.
- `references/procedural-world-generation.md` — seeded, engine-aware world-generation checks.
- `references/procedural-asset-studio.md` — reusable asset, budget, and provenance workflow.
- `references/advanced-npc-ai.md` — optional NPC architecture and edge-case validation.
- `references/game-feel-engineering.md` — responsive-feel evaluation with subjective/metric distinction.
- `references/asset-dependency-graph.md` — dependency-impact workflow without automatic deletion.
- `references/game-analytics.md` — opt-in, privacy-first analytics.
- `references/multiplayer-architecture.md` — separate multiplayer planning/security/operations workflow.
- `references/cross-platform-compatibility.md` — target matrix and evidence-based platform validation.
- `references/versioning-and-release.md` — release channels/artifacts tied to existing HANDOFF states.
- `references/persistent-project-memory.md` — extends existing canonical memory documents.
- `references/agent-browser-integration.md` — verified Agent Browser CLI adapter contract, local-only security rules and playtest limitations.
- `assets/templates/tools/agent-browser-playtest.mjs` — copyable, loopback-only adapter for bounded browser-game scenarios, screenshots, and console/page-error evidence.
- `assets/templates/tools/agent-browser-playtest.test.mjs` — offline contract tests using a fake CLI (no browser/network).
- `docs/PHASE_2_AUDIT.md` — verified pre-change audit and risks.
- `docs/PHASE_2_VALIDATION.md` — verification evidence, blocked checks, and implementation classification.

## Updated

- `SKILL.md` — added conditional module discovery without changing the original ten-stage pipeline or activation frontmatter.

## Verification status

The game-skill adapter is a project-copyable Node.js tool, not a runtime dependency of this skill or game. It was authored against `agent-browser 0.28.0` and that CLI's bundled `core --full` / `dogfood` instructions; its offline contract tests use a fake CLI and make no browser/network requests. The focused contract suite passes 7/7, and both adapter files pass `node --check`. A real gameplay/browser run is not claimed. Other Phase 2 modules remain conditional workflow guidance, not implemented game features. See `docs/PHASE_2_VALIDATION.md` for current verification status and remaining limits.
