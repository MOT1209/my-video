# Game Regression Guardian (P0, conditional)

Load this reference when changing an existing system or when the project has meaningful gameplay regression risk. This module complements — it does not replace — the quality gates in `06-vertical-slice.md`, release pass in `08-full-build.md`, visual baselines in `02-visual-debugging.md`, or defect records in `assets/templates/BACKLOG.md`.

## Before a change

1. Identify the user-visible behavior and its owning system. Trace only relevant dependencies: movement/input, collision/physics, scenes/transitions, UI, inventory/progression, NPCs, saves, audio, asset loading, level completion/restart, and performance-sensitive paths as applicable.
2. Inspect existing tests, test commands, debug hooks, logs, and known defects. Record unrelated failures before changing code where practical.
3. State the intended behavior and observable acceptance check. For risky behavior, capture a baseline (test output, deterministic scenario/state, screenshot, save fixture, or performance measurement) with environment and revision/build identity.
4. Select only affected tests first; add broader checks according to risk, changed dependencies, and release stage. Do not generate a redundant suite for a system with adequate coverage.

## After a change

1. Run the targeted test or scenario and relevant existing suite. Use the project’s actual commands and toolchain; verify availability first.
2. Compare outcome with the baseline. Classify failures as introduced, pre-existing, environment/tool blocked, or inconclusive; investigate rather than suppressing failures.
3. Fix failures attributable to the change and rerun the check that exposed each failure. Add a regression guard when feasible, based on observed behavior rather than implementation details.
4. Record check name/ID, command or procedure, environment, baseline, actual result, evidence path, and status (`PASS`, `FAIL`, `NOT RUN`, `BLOCKED`, `INCONCLUSIVE`) in the current HANDOFF or BACKLOG record. Cite exact outputs/artifact paths.
5. State coverage limits. Passing one movement scenario is not “movement fully regression-tested.”

## System-specific selection

Choose only relevant cases: movement/input boundaries; collision and physics contacts; scene transitions and interrupted loads; UI focus/repeated clicks; inventory/progression ordering and soft locks; NPC interruption/path failure; save/load migration and corruption; audio start/stop/pause/ducking; missing/slow assets; level completion/restart/recovery; and measured performance on representative hardware. Match each case to existing engine-native tests or a deterministic harness. Never assume every game has every system.

## Stop conditions

Do not mark a defect fixed until its reproducer or equivalent regression check passes after the fix. Do not claim complete protection when checks did not run, key paths lack coverage, or results are not reproducible. If baseline capture is impractical, explain why and use the smallest verifiable alternative.