CREATE TYPE "SubscriptionPlan" AS ENUM ('monthly', 'quarterly', 'yearly');
CREATE TYPE "SubscriptionOrderStatus" AS ENUM ('pending', 'paid', 'failed', 'cancelled');
CREATE TYPE "PaymentProvider" AS ENUM ('http', 'test');

CREATE TABLE "subscriptions" ("id" UUID NOT NULL, "user_id" UUID NOT NULL, "plan" "SubscriptionPlan" NOT NULL, "starts_at" TIMESTAMP(3) NOT NULL, "expires_at" TIMESTAMP(3) NOT NULL, "provider_order_id" VARCHAR(160) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "subscriptions_provider_order_id_key" ON "subscriptions"("provider_order_id");
CREATE INDEX "subscriptions_user_id_expires_at_idx" ON "subscriptions"("user_id", "expires_at");
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "subscription_orders" ("id" UUID NOT NULL, "user_id" UUID NOT NULL, "plan" "SubscriptionPlan" NOT NULL, "amount_cents" INTEGER NOT NULL, "currency" CHAR(3) NOT NULL DEFAULT 'CNY', "provider" "PaymentProvider" NOT NULL, "status" "SubscriptionOrderStatus" NOT NULL DEFAULT 'pending', "idempotency_key" VARCHAR(160) NOT NULL, "external_order_id" VARCHAR(160), "checkout_url" TEXT, "paid_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "subscription_orders_external_order_id_key" ON "subscription_orders"("external_order_id");
CREATE UNIQUE INDEX "subscription_orders_user_id_idempotency_key_key" ON "subscription_orders"("user_id", "idempotency_key");
CREATE INDEX "subscription_orders_user_id_created_at_idx" ON "subscription_orders"("user_id", "created_at");
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payment_audits" ("id" UUID NOT NULL, "user_id" UUID, "order_id" UUID, "event_id" VARCHAR(160) NOT NULL, "payload_hash" CHAR(64) NOT NULL, "verified" BOOLEAN NOT NULL, "result" VARCHAR(80) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "payment_audits_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "payment_audits_event_id_key" ON "payment_audits"("event_id");
CREATE INDEX "payment_audits_order_id_created_at_idx" ON "payment_audits"("order_id", "created_at");
ALTER TABLE "payment_audits" ADD CONSTRAINT "payment_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
