-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "whitelist_mode" VARCHAR(16) NOT NULL DEFAULT 'inherit';
ALTER TABLE "tasks" ADD COLUMN "whitelist_packages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
