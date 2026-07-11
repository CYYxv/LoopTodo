CREATE TYPE "DevicePlatform" AS ENUM ('android', 'ios');
CREATE TYPE "PushProvider" AS ENUM ('fcm', 'vendor', 'test');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('pending', 'processing', 'delivered', 'failed', 'cancelled');

CREATE TABLE "devices" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "platform" "DevicePlatform" NOT NULL,
  "device_name" VARCHAR(120) NOT NULL, "push_token" VARCHAR(512) NOT NULL, "provider" "PushProvider" NOT NULL,
  "app_version" VARCHAR(40), "enabled" BOOLEAN NOT NULL DEFAULT true, "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "notification_events" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "type" VARCHAR(48) NOT NULL, "title" VARCHAR(160) NOT NULL,
  "body" TEXT NOT NULL, "data" JSONB NOT NULL DEFAULT '{}', "dedupe_key" VARCHAR(180) NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "notification_deliveries" (
  "id" UUID NOT NULL, "event_id" UUID NOT NULL, "device_id" UUID NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending', "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL, "provider_id" VARCHAR(240), "last_error" TEXT,
  "delivered_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "devices_user_id_push_token_key" ON "devices"("user_id", "push_token");
CREATE INDEX "devices_user_id_enabled_idx" ON "devices"("user_id", "enabled");
CREATE UNIQUE INDEX "notification_events_user_id_dedupe_key_key" ON "notification_events"("user_id", "dedupe_key");
CREATE INDEX "notification_events_scheduled_at_idx" ON "notification_events"("scheduled_at");
CREATE UNIQUE INDEX "notification_deliveries_event_id_device_id_key" ON "notification_deliveries"("event_id", "device_id");
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
