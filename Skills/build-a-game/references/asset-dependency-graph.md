# Asset Dependency Graph (P1, conditional)

Use before changing/removing an asset, resource path, scene, prefab, rig, material, animation, or shared system with dependent content. Start with the engine's native resource registry/import database/build output or existing project tooling; do not assume all dependencies appear in text searches.

## Build an impact view

1. Identify the changed resource/system and its stable path/ID.
2. Inspect direct references and transitive consumers where the engine exposes them: character→model/rig/material/animation; scene/level→prefab/environment; audio event→file; script→resource; and generated data→generator/version.
3. Check missing references and load/import errors using native validation, build output, and targeted runtime tests. Validate case sensitivity and platform-specific path rules when relevant.
4. List the affected scenes/tests/features and run the narrowest relevant checks before and after. Update manifests/registries atomically using project conventions.
5. Report suspected unused assets separately with evidence and confidence. Static search misses dynamic loads, addressables, reflection, editor references, and generated paths.

Never delete assets automatically from a search result. Ask for approval before destructive cleanup; retain rollback/recovery options and use a small reversible change.