# Game Feel Engineering (P1, conditional)

Use for changes to controls, movement, camera, animation, interaction feedback, hit confirmation, timing, or pacing. Preserve the intended genre, art direction, and accessibility. This module supplements playtesting; it does not turn subjective preference into an objective pass/fail metric.

## Evaluate a representative action

1. Record the player action, intended response, current feel complaint/goal, and a reproducible scene/state.
2. Inspect input sampling, update order, frame pacing, acceleration/deceleration, jump/coyote/buffer timing if present, camera smoothing, animation transitions, interaction confirmation, and audio/VFX response as relevant.
3. Measure input-to-visible/audio response latency only if suitable instrumentation and target hardware are available; record method, environment, sample count/distribution, and limitations. Never infer end-to-end latency from code inspection alone.
4. Compare before/after using the same inputs and scenario. Capture timing traces or video when available and gather player feedback. Keep subjective notes labeled as feedback, not metric results.
5. Check reduced-motion, photosensitivity, accessibility controls, and performance. Avoid gratuitous camera shake, flashing, or effects that obscure gameplay.
6. Change one coherent factor at a time where feasible, rerun the associated regression check, and preserve the user's creative choice.

Use the engine-native profiler/capture tools discovered through `game-developer-toolkit.md`; if unavailable, say what was inspected and what was not measured.