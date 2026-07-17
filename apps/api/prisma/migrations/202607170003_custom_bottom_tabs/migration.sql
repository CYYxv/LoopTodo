ALTER TABLE "users"
ADD COLUMN "bottom_tabs" TEXT[] NOT NULL DEFAULT ARRAY['habits', 'statistics']::TEXT[],
DROP COLUMN "social_enabled";
