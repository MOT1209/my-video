# Multiplayer Architecture (P2, conditional)

Load only when multiplayer is an explicit user requirement. Never add networking, hosted services, or online accounts to a single-player game by default. First establish player count, session length, genre/latency sensitivity, platforms, persistence, privacy, expected concurrency, budget, and operational ownership.

## Architecture decisions

Compare a local/LAN, peer-hosted, authoritative server, relay, or managed service only as relevant. Document trust boundaries and source of truth for movement, combat, inventory, progression, matchmaking, and persistence. Treat clients as untrusted: validate inputs, rate-limit/limit payloads, authorize actions server-side, avoid trusting client clocks/positions/currency, and protect secrets. Plan version compatibility and save/schema migration.

Specify session creation/join, reconnect, disconnect, host migration if applicable, timeout, duplicate messages, ordering, latency/jitter/loss handling, and graceful failure. Use interpolation/prediction/rollback only when justified by genre and measured latency. Test deterministic state rules independently from transport when possible.

## Verification and operations

Plan tests for two or more clients, invalid/malicious inputs, disconnect/reconnect, packet delay/loss/reordering, stale clients, session cleanup, server load at the agreed player count, and data persistence. Use local simulation first; don't claim load capacity without measured load tests on representative infrastructure. Document monitoring, moderation/abuse handling if relevant, incident/rollback, service ownership, recurring cost, and privacy/security implications.

Do not provision accounts, deploy infrastructure, incur costs, or publish without explicit approval. If hosting/service choices require external providers, research current official terms and prices before recommending them. If multiplayer is not a confirmed requirement, skip the module.