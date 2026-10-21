# {{GAME_TITLE}}: backlog

Every playtest note and review finding, in one place. The user's words come first, then the cause once it's found. Notes given mid-build are folded into the current pass.

## Notes (from playtests and reviews)

| # | Source | Note (their words) | Where it bit | Status |
|---|---|---|---|---|
| 1 | user playtest {{DATE}} | | | open |

Status: open · fixing · fixed (say how it was verified) · won't fix (why, and the user agreed)

## Bugs

When a note is a real defect — it does the wrong thing, crashes, loses data, or breaks a beat — give it a stable id (`BUG-1`, `BUG-2`, …, a REVIEW finding gets one too) and this record, worst severity first at the top:

```text
BUG-<n>  test-id  severity  environment  status
What:    one line — what's actually wrong
Pre:     required starting state / preconditions
Where:   how it's reproduced (exact steps, or the beats/views where it shows)
Seen:    expected behaviour vs actual behaviour; label evidence type (automated / manual / simulation / static) and cite log, capture or screenshot file
Cause:   the root cause once proven — "investigating" is not a cause; leave the line empty until you know
Fix:     what was changed (say where: file(s) or the system)
Re-test: the capture scenario, selfTest check or playtest step that would catch it if it came back
Verified: the exact post-fix run that proved the fix (test/scenario ID, command or procedure, build/environment, result and evidence path). Until this line exists, status stays "fixing".
```

- **Severity:** `BLOCKER` (crash, data loss, or a core beat can't be completed) · `MAJOR` (something a player hits that's wrong or confusing) · `MINOR` (cosmetic or niche).
- **Environment:** browser and version, OS, GPU/SwiftShader, the build or screenshot (`snapshots/…`) it was seen in.
- **Fix causes, not symptoms.** No arbitrary delays to hide a mis-timed event, no special-casing one broken asset instead of fixing the loader, no exceptions planted to silence a failing check. If the honest fix is out of scope for now, that's what `won't fix` (with the user's agreement) or a deferred MAJOR is for.
- **Never write `fixed` without the verification run.** A fix that was never re-tested stays `fixing` — and the status column is what stops the same bug resurfacing unnoticed.

## Lessons promoted to rules

When a note applies to the whole game (e.g. "the player didn't know what to do"), add the rule to `AGENTS.md` and the design docs, and list it here.

-
