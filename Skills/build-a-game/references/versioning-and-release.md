# Versioning and Release Channels (P2, conditional)

Use for release candidates, multiple channels, published builds, or when the project needs a repeatable versioned artifact. Reuse the project's existing versioning/changelog convention and `docs/HANDOFF.md` release state; do not introduce a competing ledger or semver scheme when an engine/store already defines one.

## Release record

For each release candidate record: version/build identifier; channel (`Development`, `Internal Testing`, `Release Candidate`, `Production` or the project's equivalent); source revision where available; target platforms; build configuration and artifact paths/checksums; changes/release notes; known defects; test status/evidence; compatibility matrix; save-data/schema implications and migration; and rollback/recovery procedure.

A version label is not a release gate. Preserve the distinctions already defined in `10-deploy.md`: source complete, local build verified, local runtime verified, production build verified, preview deployed, and live verified. Public availability is a separate state requiring user authorization.

Before a release candidate: run relevant regression, gameplay, save/load, compatibility, security/secrets, and performance checks based on scope; record PASS/FAIL/NOT RUN/BLOCKED/INCONCLUSIVE with evidence. Retain the exact artifact that was checked. For rollback, identify the previous known-good artifact and data migration/compatibility risks. Never overwrite a frozen snapshot.

Do not publish, upload to a store, create releases, or incur hosting/service costs without explicit user approval. Record release decisions in HANDOFF and update the existing changelog if present.