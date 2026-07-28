ALTER TABLE "whitelist_lists"
  ADD COLUMN "last_mutation_key" VARCHAR(160),
  ADD COLUMN "last_mutation_fingerprint" CHAR(64);

CREATE UNIQUE INDEX "whitelist_lists_user_id_last_mutation_key_key"
  ON "whitelist_lists"("user_id", "last_mutation_key");
