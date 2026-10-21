# Procedural Asset Studio (P1, conditional)

Use when multiple assets or variants share measurable structure, or procedural creation is an explicit art-direction benefit. Do not procedurally generate everything by default; permitted, licensed authored/external assets can be the simpler choice. Reuse the current engine's asset pipeline and the project's `DESIGN_SYSTEM.md`.

## Asset workflow

1. Confirm the role, style/material palette, scale, silhouette/readability, allowed variation, target renderer, and intended reuse.
2. Inspect existing assets/components and importer settings before creating a new family. Use one reusable generator/component only when it reduces duplication and remains easy to tune.
3. Make generation reproducible where assets must match across builds: record seed, generator version, parameters, engine/tool version, and source inputs. Keep artist overrides explicit instead of silently regenerating them.
4. Validate resource paths, import/load success, missing references, transforms, UV/material expectations, animation/rig contracts when applicable, and representative in-game appearance.
5. Measure relevant cost in the target engine: mesh/triangle count, texture dimensions/formats, memory, draw calls/batching, shader/material variants, and loading impact. Compare with the project's budget; optimize only measured issues.
6. Track provenance for external/generated inputs: source, creator/provider, license/terms, retrieval/generation date, attribution obligations, and edits. Verify current terms before release; payment alone does not establish usage rights.
7. Keep asset dependencies traceable and avoid duplicate variants that differ without a player-facing purpose.

Tests and importers are engine-specific. Verify the actual tool/version before use, and label manual inspection separately from automated validation.