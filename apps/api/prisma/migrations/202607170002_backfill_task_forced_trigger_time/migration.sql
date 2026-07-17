UPDATE "tasks" AS task
SET "forced_trigger_time" = rule."trigger_time"
FROM "forced_lock_rules" AS rule
WHERE rule."task_id" = task."id"
  AND task."is_today_required" = TRUE
  AND task."forced_trigger_time" IS NULL;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_required_trigger_time_check"
CHECK (NOT "is_today_required" OR "forced_trigger_time" IS NOT NULL)
NOT VALID;
