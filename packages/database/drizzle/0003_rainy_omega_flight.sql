CREATE TYPE "public"."parameter_version_status" AS ENUM('CANDIDATE', 'VALIDATED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "parameter_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"version" text NOT NULL,
	"parameter_set" jsonb NOT NULL,
	"parameter_set_hash" text NOT NULL,
	"status" "parameter_version_status" NOT NULL,
	"parent_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"validated_at" timestamp with time zone,
	"validated_by" uuid,
	"rejected_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejection_reason" text,
	"evaluation_report" jsonb
);
--> statement-breakpoint
CREATE TABLE "project_parameter_activation" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"parameter_version_id" uuid NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "parameter_versions_organization_project_version_unique" ON "parameter_versions" USING btree ("organization_id","project_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "parameter_versions_organization_project_hash_unique" ON "parameter_versions" USING btree ("organization_id","project_id","parameter_set_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "parameter_versions_organization_project_id_unique" ON "parameter_versions" USING btree ("organization_id","project_id","id");--> statement-breakpoint
ALTER TABLE "parameter_versions" ADD CONSTRAINT "parameter_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_versions" ADD CONSTRAINT "parameter_versions_validated_by_users_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_versions" ADD CONSTRAINT "parameter_versions_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_versions" ADD CONSTRAINT "parameter_versions_organization_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_parameter_activation" ADD CONSTRAINT "project_parameter_activation_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_parameter_activation" ADD CONSTRAINT "project_parameter_activation_project_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_parameter_activation" ADD CONSTRAINT "project_parameter_activation_version_fk" FOREIGN KEY ("organization_id","project_id","parameter_version_id") REFERENCES "public"."parameter_versions"("organization_id","project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parameter_versions_project_status_idx" ON "parameter_versions" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "parameter_versions_project_created_at_idx" ON "parameter_versions" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_parameter_activation_organization_project_unique" ON "project_parameter_activation" USING btree ("organization_id","project_id");