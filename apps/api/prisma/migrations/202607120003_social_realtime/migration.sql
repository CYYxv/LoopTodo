CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE "PkMatchStatus" AS ENUM ('active', 'completed');
CREATE TYPE "StudyRoomVisibility" AS ENUM ('public', 'private');

ALTER TABLE "users" ADD COLUMN "social_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "share_current_task" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "share_completed_tasks" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "friendships" ("id" UUID NOT NULL, "requester_id" UUID NOT NULL, "addressee_id" UUID NOT NULL, "pair_key" VARCHAR(73) NOT NULL, "status" "FriendshipStatus" NOT NULL DEFAULT 'pending', "responded_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "friendships_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "friendships_pair_key_key" ON "friendships"("pair_key");
CREATE INDEX "friendships_requester_id_status_idx" ON "friendships"("requester_id", "status");
CREATE INDEX "friendships_addressee_id_status_idx" ON "friendships"("addressee_id", "status");

CREATE TABLE "pk_matches" ("id" UUID NOT NULL, "challenger_id" UUID NOT NULL, "opponent_id" UUID NOT NULL, "match_date" DATE NOT NULL, "pair_date_key" VARCHAR(84) NOT NULL, "status" "PkMatchStatus" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "pk_matches_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "pk_matches_pair_date_key_key" ON "pk_matches"("pair_date_key");
CREATE INDEX "pk_matches_challenger_id_match_date_idx" ON "pk_matches"("challenger_id", "match_date");
CREATE INDEX "pk_matches_opponent_id_match_date_idx" ON "pk_matches"("opponent_id", "match_date");

CREATE TABLE "study_rooms" ("id" UUID NOT NULL, "owner_id" UUID NOT NULL, "name" VARCHAR(120) NOT NULL, "visibility" "StudyRoomVisibility" NOT NULL DEFAULT 'public', "invite_code" VARCHAR(16), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "study_rooms_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "study_rooms_invite_code_key" ON "study_rooms"("invite_code");
CREATE INDEX "study_rooms_visibility_created_at_idx" ON "study_rooms"("visibility", "created_at");

CREATE TABLE "study_room_members" ("id" UUID NOT NULL, "room_id" UUID NOT NULL, "user_id" UUID NOT NULL, "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "left_at" TIMESTAMP(3), CONSTRAINT "study_room_members_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "study_room_members_room_id_user_id_key" ON "study_room_members"("room_id", "user_id");
CREATE INDEX "study_room_members_user_id_left_at_idx" ON "study_room_members"("user_id", "left_at");

CREATE TABLE "study_room_reactions" ("id" UUID NOT NULL, "room_id" UUID NOT NULL, "user_id" UUID NOT NULL, "emoji" VARCHAR(24) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "study_room_reactions_pkey" PRIMARY KEY ("id"));
CREATE INDEX "study_room_reactions_room_id_created_at_idx" ON "study_room_reactions"("room_id", "created_at");

ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pk_matches" ADD CONSTRAINT "pk_matches_challenger_id_fkey" FOREIGN KEY ("challenger_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pk_matches" ADD CONSTRAINT "pk_matches_opponent_id_fkey" FOREIGN KEY ("opponent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_rooms" ADD CONSTRAINT "study_rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "study_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_room_reactions" ADD CONSTRAINT "study_room_reactions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "study_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_room_reactions" ADD CONSTRAINT "study_room_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
