# AI Playtester (P0, conditional)

Use for a playable build when scenario automation or a fresh-eyes session can answer a real player-facing question. This is gameplay testing, not code review. Reuse the existing fresh-eyes protocol in `team.md` and quality gates in `06-vertical-slice.md`; do not count the same run twice as independent evidence.

## Choose a test objective

For the current milestone, select a small set of questions: does the game launch; can the player complete the main loop/objective; can they become stuck or soft-locked; do state/scene transitions work; do UI controls respond; do unusual but plausible input sequences break behavior; do repeated actions remain stable; can reported failures be reproduced? Skip irrelevant systems.

## Discover execution methods

Inspect the project's actual engine and installed tools first. Prefer, in order as appropriate: engine-native tests, existing integration/E2E tests, deterministic input scripts/simulation, an authorized browser automation interface for browser games, then manual fresh-eyes playtesting with screenshots/logs. Add no framework by default. Verify each tool exists and can reach the intended build. If unavailable, use a documented fallback and mark automation `NOT RUN`/`BLOCKED`—never imply a human or bot played when only source was inspected.

For a deterministic browser-game scenario, the optional project-copyable Agent Browser CLI adapter is documented in `agent-browser-integration.md` and provided at `assets/templates/tools/agent-browser-playtest.mjs` with an offline contract test. Verify the local build and game-specific readiness signal before use; its CLI/UI evidence alone is not proof of internal gameplay state or objective completion.

## Run a scenario

1. Identify build/revision, target platform, environment, starting save/state, controls, and test ID.
2. Start or verify the project using its documented command. Wait for a real readiness signal, not just an open page/process.
3. Give the tester only the knowledge appropriate to the test. A fresh-eyes tester receives no design docs, code, debug jumps, or puzzle hints. A directed regression scenario may use explicit preconditions.
4. Exercise goal completion, likely failure/recovery, interruptions, repeat interactions, and boundary inputs relevant to this milestone. Keep steps deterministic where the engine permits.
5. Capture actual evidence: screenshots/video, test output, runtime logs, state snapshots, or profiler results. Record missing evidence honestly.
6. Reproduce each failure at least once where feasible before assigning a cause. Report likely cause as a hypothesis until confirmed.

## Failure report

Create a stable `BUG-n` entry in `docs/BACKLOG.md` with: test ID; environment and build; preconditions; exact reproduction steps; expected and actual behavior; evidence path/log; severity; likely cause and confidence; fix/status; verification run/status. Severity follows the project's existing BLOCKER/MAJOR/MINOR definitions. Keep status `fixing` until a post-fix run proves the relevant behavior.

## Report the run

For each scenario record: objective, method (`automated`, `manual fresh-eyes`, `static inspection`, or `simulation`), command/tool/person, environment, result, evidence, failures, and limitations. Distinguish test coverage from general playability; a page loading is not proof that gameplay works. If a run is blocked, preserve the reason and do not substitute invented screenshots or logs.