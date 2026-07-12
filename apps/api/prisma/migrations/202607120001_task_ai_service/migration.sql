CREATE TYPE "ResourceType" AS ENUM ('url', 'domain', 'local_file', 'local_video', 'ai_material');
CREATE TABLE "resource_passes" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "task_id" UUID NOT NULL, "resource_type" "ResourceType" NOT NULL,
  "resource_value" TEXT NOT NULL, "trust_weight" INTEGER NOT NULL DEFAULT 100, "added_during_focus" BOOLEAN NOT NULL DEFAULT false,
  "audit_reason" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "resource_passes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ai_materials" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "task_id" UUID NOT NULL, "title" VARCHAR(160) NOT NULL,
  "content" TEXT NOT NULL, "content_hash" CHAR(64) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_materials_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ai_audits" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "task_id" UUID NOT NULL, "question_hash" CHAR(64) NOT NULL,
  "material_ids" JSONB NOT NULL, "provider" VARCHAR(40) NOT NULL, "external_data_used" BOOLEAN NOT NULL DEFAULT false,
  "blocked" BOOLEAN NOT NULL DEFAULT false, "block_reason" VARCHAR(120), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_audits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "resource_passes_user_id_task_id_created_at_idx" ON "resource_passes"("user_id", "task_id", "created_at");
CREATE INDEX "ai_materials_user_id_task_id_created_at_idx" ON "ai_materials"("user_id", "task_id", "created_at");
CREATE INDEX "ai_audits_user_id_task_id_created_at_idx" ON "ai_audits"("user_id", "task_id", "created_at");
ALTER TABLE "resource_passes" ADD CONSTRAINT "resource_passes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_passes" ADD CONSTRAINT "resource_passes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_materials" ADD CONSTRAINT "ai_materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_materials" ADD CONSTRAINT "ai_materials_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_audits" ADD CONSTRAINT "ai_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_audits" ADD CONSTRAINT "ai_audits_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
