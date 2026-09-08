CREATE UNIQUE INDEX "api_keys_project_id_unique" ON "api_keys" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "emotion_predictions_project_profile_id_unique" ON "emotion_predictions" USING btree ("project_id","profile_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "emotional_profiles_project_id_unique" ON "emotional_profiles" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_organization_id_unique" ON "projects" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "emotional_events_project_id_unique" ON "emotional_events" USING btree ("project_id","id");--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "emotional_events" child
		LEFT JOIN "emotional_profiles" parent
			ON parent."project_id" = child."project_id"
			AND parent."id" = child."profile_id"
		WHERE parent."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Migration 0002 blocked: emotional_events contains invalid project/profile relationships.'
			USING HINT = 'Remediate historical data explicitly before applying this migration; no rows were deleted.';
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "emotional_states" child
		LEFT JOIN "emotional_profiles" parent
			ON parent."project_id" = child."project_id"
			AND parent."id" = child."profile_id"
		WHERE parent."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Migration 0002 blocked: emotional_states contains invalid project/profile relationships.'
			USING HINT = 'Remediate historical data explicitly before applying this migration; no rows were deleted.';
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "emotional_memories" child
		LEFT JOIN "emotional_profiles" parent
			ON parent."project_id" = child."project_id"
			AND parent."id" = child."profile_id"
		WHERE parent."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Migration 0002 blocked: emotional_memories contains invalid project/profile relationships.'
			USING HINT = 'Remediate historical data explicitly before applying this migration; no rows were deleted.';
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "emotion_predictions" child
		LEFT JOIN "emotional_profiles" profile
			ON profile."project_id" = child."project_id"
			AND profile."id" = child."profile_id"
		WHERE profile."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Migration 0002 blocked: emotion_predictions contains invalid project/profile relationships.'
			USING HINT = 'Remediate historical data explicitly before applying this migration; no rows were deleted.';
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "emotion_predictions" child
		LEFT JOIN "emotional_events" event
			ON event."project_id" = child."project_id"
			AND event."id" = child."event_id"
		WHERE child."event_id" IS NOT NULL
			AND event."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Migration 0002 blocked: emotion_predictions contains invalid project/event relationships.'
			USING HINT = 'Remediate historical data explicitly before applying this migration; no rows were deleted.';
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "emotion_feedback" child
		LEFT JOIN "emotional_profiles" profile
			ON profile."project_id" = child."project_id"
			AND profile."id" = child."profile_id"
		WHERE profile."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Migration 0002 blocked: emotion_feedback contains invalid project/profile relationships.'
			USING HINT = 'Remediate historical data explicitly before applying this migration; no rows were deleted.';
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "emotion_feedback" child
		LEFT JOIN "emotion_predictions" prediction
			ON prediction."project_id" = child."project_id"
			AND prediction."profile_id" = child."profile_id"
			AND prediction."id" = child."prediction_id"
		WHERE prediction."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Migration 0002 blocked: emotion_feedback contains invalid project/profile/prediction relationships.'
			USING HINT = 'Remediate historical data explicitly before applying this migration; no rows were deleted.';
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "usage_records" child
		LEFT JOIN "projects" project
			ON project."organization_id" = child."organization_id"
			AND project."id" = child."project_id"
		WHERE project."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Migration 0002 blocked: usage_records contains invalid organization/project relationships.'
			USING HINT = 'Remediate historical data explicitly before applying this migration; no rows were deleted.';
	END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "usage_records" child
		LEFT JOIN "api_keys" api_key
			ON api_key."project_id" = child."project_id"
			AND api_key."id" = child."api_key_id"
		WHERE child."api_key_id" IS NOT NULL
			AND api_key."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Migration 0002 blocked: usage_records contains invalid project/API key relationships.'
			USING HINT = 'Remediate historical data explicitly before applying this migration; no rows were deleted.';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "emotion_feedback" ADD CONSTRAINT "emotion_feedback_project_profile_fk" FOREIGN KEY ("project_id","profile_id") REFERENCES "public"."emotional_profiles"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_feedback" ADD CONSTRAINT "emotion_feedback_project_prediction_fk" FOREIGN KEY ("project_id","profile_id","prediction_id") REFERENCES "public"."emotion_predictions"("project_id","profile_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_predictions" ADD CONSTRAINT "emotion_predictions_project_profile_fk" FOREIGN KEY ("project_id","profile_id") REFERENCES "public"."emotional_profiles"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_predictions" ADD CONSTRAINT "emotion_predictions_project_event_fk" FOREIGN KEY ("project_id","event_id") REFERENCES "public"."emotional_events"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotional_events" ADD CONSTRAINT "emotional_events_project_profile_fk" FOREIGN KEY ("project_id","profile_id") REFERENCES "public"."emotional_profiles"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotional_memories" ADD CONSTRAINT "emotional_memories_project_profile_fk" FOREIGN KEY ("project_id","profile_id") REFERENCES "public"."emotional_profiles"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotional_states" ADD CONSTRAINT "emotional_states_project_profile_fk" FOREIGN KEY ("project_id","profile_id") REFERENCES "public"."emotional_profiles"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_organization_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_project_api_key_fk" FOREIGN KEY ("project_id","api_key_id") REFERENCES "public"."api_keys"("project_id","id") ON DELETE no action ON UPDATE no action;