CREATE TYPE "VipStatus" AS ENUM ('free', 'active', 'expired');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "nickname" VARCHAR(80) NOT NULL,
  "avatar_url" TEXT,
  "vip_status" "VipStatus" NOT NULL DEFAULT 'free',
  "privacy_settings" JSONB NOT NULL DEFAULT '{}',
  "multi_device_focus_sync" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "device_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "device_name" VARCHAR(120) NOT NULL,
  "refresh_token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "device_sessions_user_id_revoked_at_expires_at_idx" ON "device_sessions"("user_id", "revoked_at", "expires_at");
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
