# Procedural World Generation (P1, conditional)

Use only when repeated, variable, or player-authored environments serve a confirmed design goal. A fixed handcrafted room/level usually needs no procedural generator. Preserve the project's engine, renderer, navigation, and save architecture; this is not a mandate to migrate or add libraries.

## Plan and generate

1. Define the output contract and constraints: dimensions/units, biome/theme, topology, allowed components, objective/spawn requirements, navigation rules, memory/draw budgets, target platform, and editable parameters.
2. Use a recorded seed and versioned parameter set when reproducible worlds, bug reports, save/load, or multiplayer require stable reconstruction. Record the seed, generator version, parameters, and asset references in the project-native save/test/report format. Do not assume the same random sequence across language/runtime versions.
3. Separate generation from runtime gameplay logic. Prefer deterministic pure steps for layout/topology, then engine-native instantiation. Validate generated output before committing/persisting it.
4. Check bounds, connected routes, navigation reachability, spawn/camera clearance, collision, objective reachability, soft locks, overlapping/inaccessible content, and resource budgets. Provide debug visualization only if it helps diagnose actual failures.
5. Test representative seeds plus edge/extreme parameter combinations. Keep failing seeds and minimal repro data so bugs can be replayed. Re-run after generator or constraint changes.

For Three.js/browser projects, use the existing renderer and project data structures, seedable randomness, instancing/batching where appropriate, and navigation suitable to the game. For Godot, Unity, and other engines, inspect and use their existing scene/navigation/resource conventions instead of copying Three.js APIs. Report any untested seed space; do not claim all generated worlds are valid from a few samples.