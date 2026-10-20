# Phase 5 — Production Readiness Audit (MY-VIDEO root app)

Scope: the root Next.js + Remotion SaaS. `King_Browser/` is out of scope and was not modified.
Audit date: 2026-10-20. Every claim below is backed by a command that was run, or is
explicitly marked as not verified.

---

## 1. Executive summary

The Phase 5 branch existed but contained **no Phase 5 work** (it pointed at an old commit
behind `main`). The audit found release-critical billing defects: refunds were tracked only in
process memory, a credit could be charged with no record of it, the stale-render recovery could
refund a render whose video had been uploaded, and a production deployment with no database
rendered for free without any warning. On the security side, the TTS and transcription routes
had no paid-route guard, and the rate limiter quietly fell back to per-instance memory in
production.

All of these are fixed and covered by regression tests, including multi-connection
concurrency tests on a real PostgreSQL 16 database. A root-app CI workflow was added.

**Readiness: CONDITIONALLY READY.** No known code-level critical blocker remains. The
deployment conditions in §14 are still open: run migration 0001, configure Upstash, run a live
Stripe test-mode check, and resolve the PR #6 dependency.

---

## 2. Baseline repository state (before changes)

| Item | Value |
|---|---|
| `main` | `8b777b2` (merge of PR #5) |
| `origin/phase-5/my-video-production-readiness` | `c9e914c`. This is an **ancestor of `main`, 15 commits behind, with 0 unique commits**. No Phase 5 work existed. |
| Open PR #6 (`ccr-be6ab278-migkb8`, head `de3242d`) | Not merged. Adds `guardPaidRoute` (fail-closed paid routes in production), constant-time cron secret, safe JSON parsing in `/api/render`, and security headers. **This work builds on PR #6's head** so that it does not conflict with or duplicate PR #6. |
| Open PR #7 | King_Browser docs only. Not touched. |
| Baseline `bun test` | 94 pass / 0 fail (16 files) |
| Baseline `tsc --noEmit`, `eslint .` | exit 0 / exit 0 |
| Baseline `next build` (no secrets) | exit 0 |
| Existing CI (`ci.yml`) | Runs **only King_Browser** (`working-directory: King_Browser`). The root app had no CI. |
| Schema vs migrations | `drizzle-kit generate` on the unchanged schema produced no diff, so `0000_init.sql` matched `schema.ts`. |

---

## 3. Files and components inspected

`src/lib/{auth,session,billing-session,credits,stripe,rate-limit,render-lock,render-runner,render-cache,upstash-redis,transcribe,script-generator,background-images,azure-tts,tts}.ts`,
`src/lib/db/{schema,repository,client,testing}.ts`, `drizzle/*`, `drizzle.config.ts`,
`src/app/api/**/route.ts` (all 13 routes), `src/helpers/{api-response,use-rendering}.ts`,
`types/{shorts,schema,constants}.ts`, `scripts/cleanup-blobs.ts`, `.github/workflows/*`,
`vercel.json`, `.env.example`, `README.md`, and all existing tests.

---

## 4. Verified findings

Severity scale: **Critical** (money or security loss under normal operation), **High**,
**Medium**, **Low**. "Test" names the regression test that covers the finding.

| # | Sev | Finding (evidence → root cause) | Correction | Test | Result |
|---|---|---|---|---|---|
| F1 | Critical | **Refund idempotency existed only in memory.** `billing-session.ts` used local `charged`/`refunded` flags. The cron job refunded stale rows independently with an unconditional `addCredits`. If `finishRender(error)` failed after an interactive refund, the row stayed `running` and the cron refunded it a **second** time. | New column `renders.refunded_at`. `refundRender()` is a single SQL statement that sets `refunded_at`, adds the credits and writes a negative usage row, but only when `refunded_at IS NULL AND status <> 'done'`. | `billing-session.test` "الإرجاع يقع مرة واحدة…"; `postgres.integration.test` "إرجاعات متزامنة…" (12 parallel connections) | Pass. A mutation test that removes the guard makes the PG test fail. |
| F2 | Critical | **A charge could be lost with no record.** `spendCredits` → `recordUsage` → `createRender` ran as three separate statements. A crash in between consumed a credit with no render row to refund against. If `createRender` failed, rendering continued with `renderId = null`. | `startChargedRender()` runs a single statement (data-modifying CTE): conditional debit, insert the `renders` row, insert the usage row. | `billing-session.test` "الخصم يفتح صف التصيير…"; PG "خصومات متزامنة…" | Pass |
| F3 | Critical | **Stale recovery refunded renders that had succeeded.** `reclaimStaleRunning` marked every stale `running` row as `error` and refunded it. A process killed after the Blob upload but before writing `done` therefore produced a refund **and** a stored video. | `listStaleRunning` is now read-only. `resolveStaleRenders` checks the Blob cache first: if the output exists, the row is closed as `done` with no refund. Otherwise it refunds once, then sets `error`. | `render-job.test` "الرفع نجح ثم تعذّرت كتابة done…" | Pass |
| F4 | Critical | **Production without `DATABASE_URL` rendered for free.** `openBillingSession` returned `null` and logged a warning, and the route rendered with no credit enforcement, even for Clerk-authenticated users. | In `/api/render`, `billing === null` → 503 unless `ALLOW_ANONYMOUS_PAID_ROUTES=true`, which is the explicit opt-in that already exists. If the DB is reachable but failing, `openBillingSession` throws → 503 (previously an unhandled error, and the render lock could be left held). | `routes.test` "مستخدم مسجّل في الإنتاج بلا DATABASE_URL ⇒ 503" | Pass |
| F5 | High | **Duplicate charges across instances.** The only duplicate protection was the render lock, which falls back to per-instance memory. | Partial unique index `renders_active_user_cache_uq (user_id, cache_key) WHERE status IN ('queued','running')`. A duplicate rolls back the whole charge statement and the user sees "already rendering". `claimRetry` treats the same conflict as "skip" instead of crashing the cron loop. | PG "طلبات متزامنة لنفس الفيديو…" (1 started, 11 duplicate); `render-job.test` duplicate test | Pass |
| F6 | High | **Late or stale workers could overwrite final state.** `finishRender` updated by `id` only. | `finishRender` is conditional: only `running`/`queued` rows can be closed. Retries also fence on the `attempts` value they claimed. | `render-job.test` "عامل … متأخر لا يكتب فوق…"; `billing-session.test` "صف مكتمل لا يُرجع…" | Pass |
| F7 | High | **Client disconnect could refund a successful render.** `send()` threw when the SSE stream was closed. The exception aborted the render via `onProgress`, which caused a refund. | Writes to a closed stream are swallowed (`clientGone`) and the render completes and is recorded. Any refund after an upload is blocked by `status <> 'done'`. | `render-job.test` "فشل بعد الرفع (إرسال done للعميل يرمي)…" | Pass |
| F8 | High | **`/api/tts` and `/api/transcribe` had no paid-route guard.** In production without Clerk they were open to anyone. Azure TTS is paid, and transcription calls Gemini with up to 15 MB of audio. | `guardPaidRoute()` was added to both. Transcribe rejects bodies or files over 15 MB with 413 before reading them. | `routes.test` "الإنتاج بلا Clerk: كل المسارات المكلفة تُغلق 503…" (5 routes) | Pass |
| F9 | High | **The rate limiter failed open in production.** With Upstash missing or failing, it used a per-instance in-memory counter that does not hold across serverless instances. | In production: Upstash missing or erroring → **503** (fail-closed). The opt-in `RATE_LIMIT_ALLOW_IN_MEMORY=true` restores the old behaviour. Development is unchanged. | `rate-limit.test` 3 new tests | Pass |
| F10 | High | **Async Stripe payments never granted credits.** Only `checkout.session.completed` was handled. A delayed payment method arrives with `unpaid` at completion and then sends `async_payment_succeeded`, which was ignored. | Credits are granted on `async_payment_succeeded` as well. Idempotency is keyed by `stripe_events.checkout_session_id` (unique) **in addition to** the event id, so one session can never be granted twice. | `credits.test` async test; PG "أحداث مختلفة لنفس جلسة الدفع…" | Pass. A mutation test with `ON CONFLICT (id)` fails 2 PG tests. |
| F11 | Medium | **Weak checks on webhook grants.** If `packId` was missing, the credit amount in metadata was trusted as-is. Amount and currency were not checked. `no_payment_required` granted a paid pack. | `packId` is now mandatory and must match a server pack. `amount_total` must equal the pack price and `currency` must be `usd`. Only `payment_status=paid` grants. | `credits.test` "جلسة بلا حزمة، أو بمبلغ/عملة…" | Pass |
| F12 | Medium | **Anonymous checkout in production.** Without Clerk, `/api/billing/checkout` created a paid session for the shared `local-dev-user`. | Production requires `authenticated` → 401. | `routes.test` "الشراء في الإنتاج يتطلب هوية…" | Pass |
| F13 | Medium | **Provider response bodies were leaked to clients.** Gemini, image and Azure errors embedded up to 300 characters of the provider's response in the message returned to the browser. | The status code stays in the message. The provider body is logged on the server only. | Existing provider tests still assert the status code | Pass |
| F14 | Medium | **`executeApi` returned 500 with raw Zod or JSON text for bad input.** | Malformed or invalid input → 400 with a generic message. Handler errors → 500 (our own Arabic messages). | `routes.test` "executeApi: JSON تالف…" | Pass |
| F15 | Medium | **Media URLs accepted any scheme.** `z.string().url()` accepts `file:`, `javascript:` and `data:`. Media is loaded by the render Chromium inside the sandbox, so `file:` could print sandbox files into the video. | A `MediaUrl` schema allows only http(s), up to 2048 characters (background, image, audio, music). | `routes.test` validation case `file:///etc/passwd` → 400 | Pass |
| F16 | Medium | **No request-size limit on `/api/render`.** | `readJsonBody` enforces a 256 KB limit on both the declared and the actual size (413), and returns 400 for bad JSON. | `render-job.test` "readJsonBody…"; `routes.test` 413 case | Pass |
| F17 | Low | A non-UUID ID on `/api/projects/[id]` caused a Postgres cast error → 500. | UUID validated → 404 (same message as "not yours", so it discloses nothing). | Not route-tested (needs a DB-backed session). Reviewed by inspection. | Not executed |
| F18 | Low | Pre-existing partial `mock.module` mocks (`render-errors`, `@vercel/blob`) leaked across test files and broke any test that imports the real routes. | The mocks now include the rest of each module's exports. | Full suite 3× in a row | Pass |

Findings that were checked and **not** defects:

- Stripe signature verification uses the raw body through `constructEventAsync`, and runs before any write. Already correct.
- The Stripe grant was already a single atomic statement keyed by event id. The gap was session-level duplication (F10), not partial application.
- Project ownership is enforced inside every repository query (`and(eq(id), eq(userId))`). `saveProject` refuses to update another user's row. `/api/renders`, `/api/projects` and `/api/credits` use only the server-side identity, and no route accepts a client user ID.
- Render cache keys are content hashes of the props. A cache hit returns the same video the requester's own props would produce, so it does not disclose another user's private input beyond what the requester already supplied.

---

## 5. Authentication changes

- **Paid-route guard:** PR #6's guard now also covers `/api/tts` and `/api/transcribe`. All five expensive routes fail closed in production without Clerk. `ALLOW_ANONYMOUS_PAID_ROUTES=true` is the only override: it is off by default and documented.
- `/api/billing/checkout` returns 401 for unauthenticated requests in production.
- **Behaviour change:** in production, the routes return 503 when Upstash is missing (F9) or the database is missing (F4).
- Local development is unchanged: no keys means the local user, an in-memory limiter, and billing only when `DATABASE_URL` is set.

## 6. Billing and credit-integrity changes

**Credit lifecycle (`src/lib/render-job.ts`):**

1. Validate the request.
2. Authenticate.
3. Open billing; if it is unavailable in production → 503.
4. Acquire the lock.
5. Check the cache (free).
6. `startChargedRender`, which atomically debits, inserts the row and records usage.
7. Render and upload.
8. Close the row as `done` (conditional).

On failure: `refundRender` (once) runs, then the row is closed as `error`. If the refund cannot reach the DB, the row stays `running` and the cron resolves it. Usage is net-accurate: +1 at charge, −1 at refund.

**Retryable vs terminal:** every sandbox, upload or timeout failure is refunded and then retried by the cron at most `MAX_RENDER_ATTEMPTS = 3` times in total. It becomes terminal at `attempts = 3`. Input validation failures are rejected before any charge. A retry that succeeds after a refund is **free to the user**. This is the existing, documented product decision and was kept as-is.

## 7. Render reliability changes

The state machine is documented in `src/lib/render-recovery.ts`. Every transition is a conditional SQL statement. `done` is terminal and is never overwritten or refunded. The cron logic was moved into `render-recovery.ts` (stale resolution plus fenced retries) so that it can be tested against a real database.

## 8. Database and migration findings

**Migration `drizzle/0001_phase5_billing_integrity.sql`** (generated by `drizzle-kit`, journal and snapshot updated):

- Adds `renders.refunded_at`.
- Adds `stripe_events.checkout_session_id` with a unique constraint.
- Adds the partial unique index `renders_active_user_cache_uq`.
- **Backfill:** existing `error` rows with `credits_used > 0` get `refunded_at = updated_at`, because the old code already refunded them in memory. This is conservative: it prevents a double refund, at the risk of not refunding a row whose old in-memory refund silently failed.
- **Upgrade risk:** creating the unique index fails, and the transactional migration rolls back, if a user already has two `queued`/`running` rows with the same `cache_key`. Run this pre-check before migrating:

  ```sql
  select user_id, cache_key, count(*) from renders
  where status in ('queued','running') and cache_key is not null
  group by 1, 2 having count(*) > 1;
  ```

  If it returns rows, wait for the cron to resolve them (they are stale after 15 minutes), or close them manually.
- **Nothing destructive:** no columns or tables are dropped.

**Verification:**

- Clean migration from an empty database (PGlite, and real PostgreSQL 16 in the integration suite).
- Upgrade test: apply `0000`, insert legacy rows, apply `0001`, then check the backfill (`migrations.test.ts`).
- Journal-to-file consistency check.
- Constraint enforcement and `ON DELETE` behaviour: user delete cascades to projects, renders and usage; Stripe events keep the purchase record with `user_id` set to null.
- CI fails if `schema.ts` changes without a committed migration.

**Manual steps (production):**

1. Run the pre-check above.
2. Run `npx drizzle-kit migrate` against Neon **before** deploying this code. The new code writes `refunded_at` and `checkout_session_id`, so it fails without the migration.

The migration was **not** run against Neon or any production database.

## 9. CI changes

- **New workflow:** `.github/workflows/root-app-ci.yml`. It runs on `pull_request` (any base) and on `push` to `main` and `phase-*/**`. Steps:
  - `npm ci`
  - `npm audit --omit=dev --audit-level=high`
  - ESLint
  - `tsc --noEmit`
  - Drizzle drift check
  - `bun test` against a `postgres:16` service container
  - An explicit check that the PostgreSQL suite **ran** rather than being skipped
  - `next build` with no secrets
- **Limits of the build step:** it proves the app compiles and prerenders. It does **not** verify a deployment with real Clerk, Stripe, Neon or Blob.
- **King Browser:** `ci.yml` (King Browser) and `codeql.yml` were not modified. The root-app job has its own name, `MY-VIDEO — …`.
- **Dependencies:** `pg@8.13.1` and `@types/pg@8.11.10` were added as devDependencies, used only by the integration test. The lockfile diff is additions only.

## 10. Tests executed (local, this environment)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | exit 0 |
| `bun test` (no `TEST_DATABASE_URL`) | **127 pass, 9 skip, 0 fail** (20 files). Run 3×, all identical. |
| `TEST_DATABASE_URL=postgres://…/myvideo_test bun test` (local PostgreSQL 16.15, disposable DB) | **134 pass, 0 fail** |
| Mutation: drop `refunded_at IS NULL` guard | PG suite: 1 fail (expected) |
| Mutation: `ON CONFLICT (id)` instead of no target | PG suite: 2 fail (expected) |
| `npx drizzle-kit generate` after the changes | "No schema changes" |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `npx next build` (no secrets) | exit 0 |

CI results on GitHub are recorded in the pull request. CI had not run when this file was written.

## 11. Tests not executed, and why

- **Live Stripe (test mode) end to end:** checkout → webhook → credit grant. No Stripe keys in this environment. The webhook route was tested with real Stripe-signed payloads (`generateTestHeaderStringAsync`) but without a database behind the route. Grant atomicity was tested at the repository level on PGlite and real PostgreSQL. **Mocks and local signatures do not prove live Stripe behaviour.**
- **Clerk:** mocked (`@clerk/nextjs/server`). Real session and JWT handling was not exercised.
- **Neon over HTTP:** the SQL was tested on PostgreSQL 16 through `pg`, not through `@neondatabase/serverless`. The statements are single statements with standard semantics, but the driver path is unverified.
- **Vercel Sandbox, Blob and Upstash:** mocked or injected. Real render, upload, timeout and `waitUntil` behaviour on Vercel was not exercised.
- **`/api/projects/[id]` UUID validation (F17):** not route-tested.
- **Full HTTP route test of `/api/render` with a database:** not run. The orchestration is tested through `executeRenderJob` with a real database and an injected render function.

## 12. Known limitations and residual risks

1. **Free video in a narrow race.** If the cron refunds a stale row and a still-alive worker then writes `done`, the user keeps both the refund and the video. This needs the worker to outlive the 15-minute stale window, longer than the default Vercel function limit. It does not cause data corruption.
2. **Anonymous opt-in mode** (`ALLOW_ANONYMOUS_PAID_ROUTES=true` with a database): all visitors share one `local-dev-user` credit balance. This pre-existing behaviour is documented and not intended for public deployments.
3. **Render outputs are public Blob URLs** (`access: "public"`) under content-hash paths. Anyone who has a URL can view the video. `scripts/cleanup-blobs.ts` cleans only `shorts-audio/` and `snapshot-cache/`; **render outputs and background images are kept indefinitely**.
4. **Deleting a user** cascades to that user's database rows. Blobs are not deleted, because cache paths are shared across users, and there is no self-service delete endpoint.
5. **Logs:** some logs print full error objects. Drizzle query errors can include bound parameters such as clerk ID and email. No secrets were found in logs. The PII-in-logs risk is reduced, not eliminated.
6. **The render lock** still falls back to memory when an Upstash call fails. Credits and the unique index now bound the cost, so this is no longer a billing risk.
7. **Stripe Tax and discounts** would change `amount_total` and be rejected as `invalid-credits` (the event returns 200 and is logged). The amount check must be revisited before enabling either.
8. **`x-forwarded-for` trust.** The first address is used as the client IP. This relies on Vercel overwriting the header, and does not hold on other hosts.
9. **No legal or compliance claims** (GDPR, retention periods) are made by this audit.

## 13. Required environment variables (production)

| Variable | Requirement |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Required. Without it, render returns 503. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Required. Without them, paid routes return 503 and checkout returns 401. |
| `DATABASE_URL` | Required. Without it, render returns 503. Run migration 0001 first. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **Newly required.** Without them, paid routes return 503. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Required to sell credits. Subscribe the webhook to both `checkout.session.completed` **and `checkout.session.async_payment_succeeded`**. |
| `CRON_SECRET` | Required for stale recovery and refunds. **Without it, stale rows are never refunded.** |
| `GEMINI_API_KEY`, `AZURE_SPEECH_*` | Optional feature keys. |
| `ALLOW_ANONYMOUS_PAID_ROUTES`, `RATE_LIMIT_ALLOW_IN_MEMORY` | Opt-outs. Leave unset in a public deployment. |

## 14. Deployment and rollback

**Order:**

1. Merge PR #6, or merge this PR, which contains it.
2. Run the duplicate pre-check (§8).
3. Run `drizzle-kit migrate` on Neon.
4. Set the Upstash variables.
5. Add the async Stripe event to the webhook.
6. Deploy.
7. In Stripe test mode, buy the `starter` pack, then replay the event from the dashboard. Check that credits increase by 10 exactly once.

**Rollback:**

- The code can be rolled back to the previous deployment.
- Migration 0001 is additive and the old code ignores the new column and index. It is backward-compatible, so **do not revert the migration**.
- If the old code runs again, its in-memory refund semantics return (F1).

## 15. Final readiness assessment

**CONDITIONALLY READY.** The code-level release-critical defects found in this audit (F1–F5) are fixed and covered by tests, including real-PostgreSQL concurrency tests. Deploying still requires all of the following:

- (a) Migration 0001 has been applied.
- (b) Upstash is configured, otherwise paid routes return 503 by design.
- (c) The Stripe webhook is subscribed to the async event and verified once in test mode.
- (d) PR #6 is merged together with, or before, this change.
- (e) Root-app CI is green on the final commit.
