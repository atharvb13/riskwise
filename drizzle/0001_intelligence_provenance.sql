CREATE TYPE "event_source_kind" AS ENUM ('live', 'baseline', 'legacy');
--> statement-breakpoint
ALTER TABLE "risk_events"
  ADD COLUMN "source_kind" "event_source_kind" DEFAULT 'legacy' NOT NULL,
  ADD COLUMN "source_provider" text,
  ADD COLUMN "source_event_id" text,
  ADD COLUMN "fingerprint" varchar(64),
  ADD COLUMN "observed_at" timestamp,
  ADD COLUMN "last_seen_at" timestamp;
--> statement-breakpoint
-- Existing rows retain their original age and are not relabelled as live evidence.
UPDATE "risk_events" SET "last_seen_at" = "created_at";
--> statement-breakpoint
ALTER TABLE "risk_events"
  ALTER COLUMN "last_seen_at" SET DEFAULT now(),
  ALTER COLUMN "last_seen_at" SET NOT NULL,
  ADD CONSTRAINT "risk_events_fingerprint_unique" UNIQUE ("fingerprint");
--> statement-breakpoint
CREATE INDEX "risk_events_active_seen_idx" ON "risk_events" ("is_active", "last_seen_at");
