ALTER TABLE "focus_sessions"
  ADD COLUMN "restriction_mode" "RestrictionMode" NOT NULL DEFAULT 'none',
  ADD COLUMN "whitelist_source" VARCHAR(160) NOT NULL DEFAULT 'none',
  ADD COLUMN "whitelist_package_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "restriction_effective" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "effective_minutes" INTEGER NOT NULL DEFAULT 0;

UPDATE "focus_sessions"
SET "effective_minutes" = COALESCE("actual_minutes", 0)
WHERE "ended_at" IS NOT NULL;
