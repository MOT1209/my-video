# Advanced NPC AI (P1, conditional)

Load only when the game has NPC behavior with enough states/interactions to justify an explicit model. Choose the simplest option that meets the confirmed behavior: direct scripted logic for a few fixed events; finite-state machine for small explicit modes; behavior tree/utility selection for richer priority combinations; navigation/perception/memory only when gameplay uses them. Inspect the engine's current AI/navigation tools first.

## Design and safeguards

- Define state/action contracts, allowed transitions, interruption/cancellation behavior, timers, ownership of movement/animation, and what the player sees when an action cannot run.
- Make transitions explicit; guard against zero-time loops, repeated event scheduling, invalid/missing targets, stale references, unreachable destinations, navigation changes, and interruption during path/action execution.
- Handle no-path/no-target/action-failed results with a bounded, visible recovery (retry budget, fallback destination/action, or safe idle); never leave NPCs spinning or silently blocking progression.
- Avoid expensive full perception/path queries every frame. Use engine-native update cadence, events, or cached data where suitable; profile before optimizing.
- Make tests reproducible with fixed inputs/seeds and controlled time where feasible. Cover valid and invalid transitions, unreachable targets, interruption, repeated triggers, save/load restoration, and critical gameplay outcomes.
- Keep externally generated dialogue separate from authoritative state transitions and critical gameplay logic. No LLM/API/dependency by default; require a justified user-approved design, privacy/security review, cost approval, and deterministic fallback before any external generation.

Document the chosen model and tests in the existing architecture plan and HANDOFF; do not create a second NPC specification ledger.