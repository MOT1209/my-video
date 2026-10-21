# Game Quality Contract (shared rule)

This contract normalizes reporting for the optional engineering modules. It does not replace the 10-stage pipeline or its per-step acceptance criteria.

## Evidence states

Use exactly one status per check: `PASS` (the check ran and met its stated criterion), `FAIL` (ran and did not meet it), `NOT RUN` (not attempted), `BLOCKED` (attempted/planned but an identified prerequisite prevented it), or `INCONCLUSIVE` (ran but evidence cannot decide). Include the command/scenario, build/revision, environment, result, and evidence location. Static inspection, automated tests, simulation, manual play, and browser automation are distinct methods; label them accurately.

## Gate rules

- Derive the checks from the user's confirmed requirements and the current milestone's acceptance criteria. Don't add a gate for an absent feature.
- Baseline current relevant behavior before a risky change when practical; identify unrelated pre-existing failures separately.
- A required acceptance check that is `FAIL`, `NOT RUN`, `BLOCKED`, or `INCONCLUSIVE` prevents claiming that gate passed. Explain whether the milestone itself is blocked or another accepted criterion permits continuation.
- After a change, run the check that verifies the behavior and the affected regression tests. Fix introduced failures; never hide them with skipped tests, weakened assertions, or suppressions.
- Broader suite size follows risk and release stage. Record coverage limits, including which systems/scenarios were not exercised.
- For visual/performance work, keep the established golden-frame process and physical-device p95 methodology. A screenshot or software-renderer result is not a gameplay pass or physical-device performance result.

## Single source of truth

Append milestone results and links to `docs/HANDOFF.md`; defects belong in `docs/BACKLOG.md`. Do not create another status ledger unless the project has a separate established system. Keep the original per-step gates authoritative; this file defines status/evidence language only.