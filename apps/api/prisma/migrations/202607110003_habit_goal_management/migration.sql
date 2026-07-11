CREATE TYPE "HabitStatus" AS ENUM ('active', 'archived');

CREATE TABLE "task_progress_entries" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "task_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL, "idempotency_key" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_progress_entries_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "habits" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "name" VARCHAR(120) NOT NULL,
  "target_minutes" INTEGER NOT NULL, "force_enabled" BOOLEAN NOT NULL DEFAULT false,
  "trigger_time" CHAR(5), "status" "HabitStatus" NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 1, "progress_updated_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "habit_progress_entries" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "habit_id" UUID NOT NULL,
  "minutes" INTEGER NOT NULL, "progress_date" DATE NOT NULL, "idempotency_key" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "habit_progress_entries_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "forced_lock_rules" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "task_id" UUID, "habit_id" UUID,
  "trigger_time" CHAR(5) NOT NULL, "buffer_minutes" INTEGER NOT NULL DEFAULT 10,
  "max_delay_count" INTEGER NOT NULL DEFAULT 2, "delay_minutes" INTEGER NOT NULL DEFAULT 20,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "forced_lock_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "task_progress_entries_user_id_idempotency_key_key" ON "task_progress_entries"("user_id", "idempotency_key");
CREATE INDEX "task_progress_entries_task_id_created_at_idx" ON "task_progress_entries"("task_id", "created_at");
CREATE INDEX "habits_user_id_status_updated_at_idx" ON "habits"("user_id", "status", "updated_at");
CREATE UNIQUE INDEX "habit_progress_entries_user_id_idempotency_key_key" ON "habit_progress_entries"("user_id", "idempotency_key");
CREATE INDEX "habit_progress_entries_habit_id_progress_date_idx" ON "habit_progress_entries"("habit_id", "progress_date");
CREATE UNIQUE INDEX "forced_lock_rules_habit_id_key" ON "forced_lock_rules"("habit_id");
CREATE INDEX "forced_lock_rules_user_id_enabled_idx" ON "forced_lock_rules"("user_id", "enabled");
ALTER TABLE "task_progress_entries" ADD CONSTRAINT "task_progress_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_progress_entries" ADD CONSTRAINT "task_progress_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "habit_progress_entries" ADD CONSTRAINT "habit_progress_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "habit_progress_entries" ADD CONSTRAINT "habit_progress_entries_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forced_lock_rules" ADD CONSTRAINT "forced_lock_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forced_lock_rules" ADD CONSTRAINT "forced_lock_rules_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forced_lock_rules" ADD CONSTRAINT "forced_lock_rules_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
