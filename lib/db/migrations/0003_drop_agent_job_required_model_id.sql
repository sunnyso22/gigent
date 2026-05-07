DROP INDEX IF EXISTS "agent_job_model_idx";--> statement-breakpoint
ALTER TABLE "agent_job" DROP COLUMN IF EXISTS "required_model_id";
