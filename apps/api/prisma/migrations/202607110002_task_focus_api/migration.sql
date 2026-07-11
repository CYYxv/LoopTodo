CREATE TYPE "TaskType" AS ENUM ('pomodoro', 'goal');
CREATE TYPE "TimerMode" AS ENUM ('countdown', 'countup', 'untimed');
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'active', 'completed', 'failed', 'archived');
CREATE TYPE "SessionMode" AS ENUM ('focus', 'lock');
CREATE TYPE "TrustLevel" AS ENUM ('high', 'normal', 'open', 'invalid');
CREATE TYPE "FocusOutcome" AS ENUM ('completed', 'failed', 'cancelled', 'emergency_exit');

CREATE TABLE "task_categories" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "name" VARCHAR(80) NOT NULL,
  "color" VARCHAR(32), "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tasks" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "category_id" UUID, "title" VARCHAR(240) NOT NULL,
  "task_type" "TaskType" NOT NULL, "timer_mode" "TimerMode" NOT NULL,
  "estimated_minutes" INTEGER NOT NULL, "rest_minutes" INTEGER NOT NULL DEFAULT 5,
  "deadline_at" TIMESTAMP(3), "target_amount" DECIMAL(12,2), "target_unit" VARCHAR(40),
  "completed_amount" DECIMAL(12,2) NOT NULL DEFAULT 0, "is_today_required" BOOLEAN NOT NULL DEFAULT false,
  "status" "TaskStatus" NOT NULL DEFAULT 'pending', "active_session_id" UUID, "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_family_member_id" UUID, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "focus_sessions" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "task_id" UUID NOT NULL,
  "mode" "SessionMode" NOT NULL, "timer_mode" "TimerMode" NOT NULL,
  "trust_level" "TrustLevel" NOT NULL DEFAULT 'normal', "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3), "planned_minutes" INTEGER NOT NULL, "actual_minutes" INTEGER,
  "outcome" "FocusOutcome", "completion_note" TEXT, "failure_reason_type" VARCHAR(80),
  "failure_reason_text" TEXT, "start_idempotency_key" VARCHAR(160) NOT NULL,
  "finish_idempotency_key" VARCHAR(160), "synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_categories_user_id_name_key" ON "task_categories"("user_id", "name");
CREATE INDEX "task_categories_user_id_updated_at_idx" ON "task_categories"("user_id", "updated_at");
CREATE INDEX "tasks_user_id_status_updated_at_idx" ON "tasks"("user_id", "status", "updated_at");
CREATE INDEX "tasks_user_id_active_session_id_idx" ON "tasks"("user_id", "active_session_id");
CREATE UNIQUE INDEX "focus_sessions_user_id_start_idempotency_key_key" ON "focus_sessions"("user_id", "start_idempotency_key");
CREATE UNIQUE INDEX "focus_sessions_user_id_finish_idempotency_key_key" ON "focus_sessions"("user_id", "finish_idempotency_key");
CREATE INDEX "focus_sessions_user_id_updated_at_idx" ON "focus_sessions"("user_id", "updated_at");
CREATE INDEX "focus_sessions_task_id_ended_at_idx" ON "focus_sessions"("task_id", "ended_at");
ALTER TABLE "task_categories" ADD CONSTRAINT "task_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "task_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
