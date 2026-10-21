# Persistent Project Memory (P2, applies to continuity)

The existing `AGENTS.md`, `docs/HANDOFF.md`, requirements/design/architecture documents, and `docs/BACKLOG.md` remain the sources of truth. This reference strengthens their use; it does not create a second handoff or memory database.

## Session start

Read repository instructions, `AGENTS.md`, and `docs/HANDOFF.md` when present. Verify the current pipeline step, release state, open questions, unresolved defects, current requirements/architecture, latest verified test/performance evidence, and next action. Treat old chat summaries and stale reports as context, not current truth. If records conflict, stop and resolve/document the conflict instead of guessing.

## After meaningful work

Update only relevant canonical documents: confirmed decisions/assumptions and open questions in requirements/HANDOFF; architecture changes in TECH_PLAN; defects and reproductions in BACKLOG; test IDs/results/evidence/status and environment in HANDOFF; performance baselines with hardware/scenario and before/after results; release artifact/channel in release-state area. Link large logs/captures rather than copying them into multiple documents. Keep dates/build identifiers so stale evidence is recognizable.

## Fresh-session reconstruction

A fresh agent should be able to answer from repository files: what game/project and engine; what was explicitly decided vs assumed; what stage/release state it is in; what checks actually ran and their results; what remains broken/open; what must happen next; and what must not be changed/deployed without approval. If not, repair the relevant canonical doc rather than creating a competing file.
