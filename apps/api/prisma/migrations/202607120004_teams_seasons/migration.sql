CREATE TYPE "SeasonStatus" AS ENUM ('active', 'settled');
CREATE TYPE "TeamRole" AS ENUM ('leader', 'member');

CREATE TABLE "seasons" ("id" UUID NOT NULL, "name" VARCHAR(80) NOT NULL, "starts_at" TIMESTAMP(3) NOT NULL, "ends_at" TIMESTAMP(3) NOT NULL, "status" "SeasonStatus" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "seasons_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "seasons_starts_at_key" ON "seasons"("starts_at");
CREATE INDEX "seasons_status_ends_at_idx" ON "seasons"("status", "ends_at");

ALTER TABLE "score_events" ADD COLUMN "season_id" UUID;
CREATE INDEX "score_events_season_id_total_score_idx" ON "score_events"("season_id", "total_score");
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "rank_snapshots" ("id" UUID NOT NULL, "season_id" UUID NOT NULL, "user_id" UUID NOT NULL, "score" INTEGER NOT NULL, "tier" VARCHAR(32) NOT NULL, "position" INTEGER NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "rank_snapshots_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "rank_snapshots_season_id_user_id_key" ON "rank_snapshots"("season_id", "user_id");
CREATE INDEX "rank_snapshots_season_id_position_idx" ON "rank_snapshots"("season_id", "position");
CREATE INDEX "rank_snapshots_user_id_created_at_idx" ON "rank_snapshots"("user_id", "created_at");
ALTER TABLE "rank_snapshots" ADD CONSTRAINT "rank_snapshots_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rank_snapshots" ADD CONSTRAINT "rank_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "teams" ("id" UUID NOT NULL, "leader_id" UUID NOT NULL, "name" VARCHAR(120) NOT NULL, "join_code" VARCHAR(16) NOT NULL, "member_count" INTEGER NOT NULL DEFAULT 0, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "teams_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");
CREATE UNIQUE INDEX "teams_join_code_key" ON "teams"("join_code");
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "team_members" ("id" UUID NOT NULL, "team_id" UUID NOT NULL, "user_id" UUID NOT NULL, "role" "TeamRole" NOT NULL DEFAULT 'member', "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "team_members_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "team_members_user_id_key" ON "team_members"("user_id");
CREATE INDEX "team_members_team_id_joined_at_idx" ON "team_members"("team_id", "joined_at");
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
