# Game Intelligence (P1, conditional)

Load only before a consequential gameplay/system feature that could change the player's experience. Reuse the step-1 interview, `GAME_REQUIREMENTS.md`, `GAME_DESIGN.md`, and approved decisions; this is a design analysis lens, not another interview or approval mechanism.

## Evaluate the proposed feature

Write a short note answering only applicable questions:
- What core loop and player motivation does it strengthen?
- What feedback/reward communicates progress? How does it affect progression and difficulty?
- Does it improve replayability in a way the user wants, or add content with no repeat value?
- Which existing systems/levels/assets/controls interact with it? Are there contradictions with story rules, accessibility, or confirmed requirements?
- What is the smallest implementation that delivers the intended player experience?
- What are the implementation, testing, performance, save-compatibility, and maintenance risks?

Compare alternatives only when the choice materially changes scope, architecture, cost, accessibility, or player experience. State trade-offs in plain language and preserve the user's decision. Keep accepted decisions in the existing HANDOFF/requirements/design sources of truth.

Reject unnecessary feature accumulation: name redundant or conflicting behavior and recommend omission or a smaller variant. Do not silently remove requested functionality. Do not imitate a commercial game's distinctive protected characters, story, art, audio, or assets; translate high-level genre goals into original expression. For substantial requirement/architecture changes, return to the existing approval gate in `SKILL.md` before implementation.