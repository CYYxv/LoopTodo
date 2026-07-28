ALTER TABLE "focus_sessions"
  ADD COLUMN "allowed_packages_snapshot" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
