ALTER TABLE "renders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: before this migration a failed render's credit was refunded in process memory
-- (or by the stale-row reclaim) without a persistent marker. Treat every legacy charged
-- "error" row as already refunded so the new idempotent refund path can never pay it twice.
UPDATE "renders" SET "refunded_at" = "updated_at" WHERE "status" = 'error' AND "credits_used" > 0 AND "refunded_at" IS NULL;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN "checkout_session_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "renders_active_user_cache_uq" ON "renders" USING btree ("user_id","cache_key") WHERE "renders"."status" in ('queued', 'running') and "renders"."cache_key" is not null;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD CONSTRAINT "stripe_events_checkout_session_id_unique" UNIQUE("checkout_session_id");