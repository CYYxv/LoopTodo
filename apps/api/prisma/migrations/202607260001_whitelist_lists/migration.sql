CREATE TYPE "RestrictionMode" AS ENUM ('none', 'whitelist', 'strict');
CREATE TYPE "WhitelistMode" AS ENUM ('list', 'custom');

CREATE TABLE "whitelist_lists" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "packages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "whitelist_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whitelist_lists_user_id_updated_at_idx" ON "whitelist_lists"("user_id", "updated_at");
CREATE UNIQUE INDEX "whitelist_lists_one_active_default_per_user" ON "whitelist_lists"("user_id") WHERE "is_default" = true AND "archived_at" IS NULL;
CREATE UNIQUE INDEX "whitelist_lists_active_name_per_user" ON "whitelist_lists"("user_id", "name") WHERE "archived_at" IS NULL;

ALTER TABLE "whitelist_lists" ADD CONSTRAINT "whitelist_lists_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "whitelist_lists" ("id", "user_id", "name", "packages", "is_default", "version", "created_at", "updated_at")
SELECT (
  substr(md5("id"::text || ':default-whitelist'), 1, 8) || '-' ||
  substr(md5("id"::text || ':default-whitelist'), 9, 4) || '-' ||
  substr(md5("id"::text || ':default-whitelist'), 13, 4) || '-' ||
  substr(md5("id"::text || ':default-whitelist'), 17, 4) || '-' ||
  substr(md5("id"::text || ':default-whitelist'), 21, 12)
)::uuid, "id", '默认白名单', ARRAY[]::TEXT[], true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users";

ALTER TABLE "tasks" ADD COLUMN "restriction_mode" "RestrictionMode" NOT NULL DEFAULT 'whitelist';
ALTER TABLE "tasks" ADD COLUMN "whitelist_list_id" UUID;
ALTER TABLE "tasks" ALTER COLUMN "whitelist_mode" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "whitelist_mode" TYPE "WhitelistMode"
  USING (CASE WHEN "whitelist_mode" = 'custom' THEN 'custom' ELSE 'list' END)::"WhitelistMode";
ALTER TABLE "tasks" ALTER COLUMN "whitelist_mode" SET DEFAULT 'list';

UPDATE "tasks" AS task
SET "whitelist_list_id" = list."id",
    "whitelist_packages" = ARRAY[]::TEXT[]
FROM "whitelist_lists" AS list
WHERE list."user_id" = task."user_id"
  AND list."is_default" = true
  AND list."archived_at" IS NULL
  AND task."whitelist_mode" = 'list';

CREATE INDEX "tasks_user_id_whitelist_list_id_idx" ON "tasks"("user_id", "whitelist_list_id");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_whitelist_list_id_fkey"
  FOREIGN KEY ("whitelist_list_id") REFERENCES "whitelist_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
