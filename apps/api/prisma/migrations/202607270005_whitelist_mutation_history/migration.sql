CREATE TABLE "whitelist_mutations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(160) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "response" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whitelist_mutations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "whitelist_mutations" (
  "id", "user_id", "idempotency_key", "fingerprint", "response", "created_at"
)
SELECT
  gen_random_uuid(),
  "user_id",
  "last_mutation_key",
  "last_mutation_fingerprint",
  jsonb_build_object(
    'id', "id",
    'userId', "user_id",
    'name', "name",
    'packages', "packages",
    'isDefault', "is_default",
    'version', "version",
    'createdAt', "created_at",
    'updatedAt', "updated_at",
    'archivedAt', "archived_at"
  ),
  "updated_at"
FROM "whitelist_lists"
WHERE "last_mutation_key" IS NOT NULL
  AND "last_mutation_fingerprint" IS NOT NULL;

CREATE UNIQUE INDEX "whitelist_mutations_user_id_idempotency_key_key"
  ON "whitelist_mutations"("user_id", "idempotency_key");
CREATE INDEX "whitelist_mutations_user_id_created_at_idx"
  ON "whitelist_mutations"("user_id", "created_at");

ALTER TABLE "whitelist_mutations"
  ADD CONSTRAINT "whitelist_mutations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "whitelist_lists_user_id_last_mutation_key_key";
ALTER TABLE "whitelist_lists"
  DROP COLUMN "last_mutation_key",
  DROP COLUMN "last_mutation_fingerprint";
