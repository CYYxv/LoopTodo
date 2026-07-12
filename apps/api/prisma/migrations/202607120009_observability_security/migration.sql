CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "category" VARCHAR(32) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "outcome" VARCHAR(24) NOT NULL,
    "target_type" VARCHAR(48),
    "target_hash" CHAR(64),
    "request_id" VARCHAR(128),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_events_category_action_created_at_idx" ON "security_events"("category", "action", "created_at");
CREATE INDEX "security_events_actor_id_created_at_idx" ON "security_events"("actor_id", "created_at");
CREATE INDEX "security_events_request_id_idx" ON "security_events"("request_id");
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
