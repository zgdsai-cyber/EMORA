ALTER TABLE "parameter_versions" ADD CONSTRAINT "parameter_versions_parent_scope_fk" FOREIGN KEY ("organization_id","project_id","parent_version_id") REFERENCES "public"."parameter_versions"("organization_id","project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "parameter_versions_immutable_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'parameter_versions rows are append-only; deletion is forbidden.';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.organization_id IS DISTINCT FROM NEW.organization_id
    OR OLD.project_id IS DISTINCT FROM NEW.project_id
    OR OLD.version IS DISTINCT FROM NEW.version
    OR OLD.parameter_set IS DISTINCT FROM NEW.parameter_set
    OR OLD.parameter_set_hash IS DISTINCT FROM NEW.parameter_set_hash
    OR OLD.parent_version_id IS DISTINCT FROM NEW.parent_version_id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
    OR OLD.created_by IS DISTINCT FROM NEW.created_by
  THEN
    RAISE EXCEPTION 'parameter_versions immutable snapshot fields cannot be modified.';
  END IF;

  IF OLD.status = 'VALIDATED' OR OLD.status = 'REJECTED' THEN
    RAISE EXCEPTION 'validated or rejected parameter_versions cannot be modified.';
  END IF;

  IF OLD.status = 'CANDIDATE' AND NEW.status NOT IN ('VALIDATED', 'REJECTED') THEN
    RAISE EXCEPTION 'parameter_versions allow only CANDIDATE to VALIDATED or REJECTED transitions.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "parameter_versions_immutable_guard_trigger"
BEFORE UPDATE OR DELETE ON "parameter_versions"
FOR EACH ROW EXECUTE FUNCTION "parameter_versions_immutable_guard"();