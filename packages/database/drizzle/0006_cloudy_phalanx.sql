ALTER TABLE "emotional_events" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "emotional_events" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "emotional_states" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "emotional_states" ADD CONSTRAINT "emotional_states_project_event_fk" FOREIGN KEY ("project_id","event_id") REFERENCES "public"."emotional_events"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "emotional_events_idempotency_key_unique" ON "emotional_events" USING btree ("project_id","profile_id","idempotency_key") WHERE "emotional_events"."idempotency_key" IS NOT NULL;
--> statement-breakpoint
-- Slice 1 controlled seed: the deterministic runtime model identity that
-- emotional_states.model_version_id references. Idempotent on the existing
-- (name, version) unique index; no tenancy and no training provenance.
INSERT INTO "model_versions" ("name", "version", "dataset_version", "parameter_set", "status")
VALUES ('emora-deterministic-dynamics', '1.0.0', NULL, NULL, 'active')
ON CONFLICT ("name", "version") DO NOTHING;