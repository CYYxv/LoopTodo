CREATE TYPE "NetworkPolicy" AS ENUM ('offline_first', 'online_required');
ALTER TABLE "users" ADD COLUMN "network_policy" "NetworkPolicy" NOT NULL DEFAULT 'offline_first', ADD COLUMN "task_reminders_enabled" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "family_alerts_enabled" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "reward_notifications_enabled" BOOLEAN NOT NULL DEFAULT true;
