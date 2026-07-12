CREATE TABLE "score_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "score_date" DATE NOT NULL,
    "outcome" "FocusOutcome" NOT NULL,
    "trust_level" "TrustLevel" NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "streak_days" INTEGER NOT NULL,
    "duration_score" INTEGER NOT NULL,
    "streak_score" INTEGER NOT NULL,
    "trust_score" INTEGER NOT NULL,
    "penalty_score" INTEGER NOT NULL DEFAULT 0,
    "total_score" INTEGER NOT NULL,
    "formula_version" VARCHAR(40) NOT NULL,
    "streak_award_key" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "score_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "score_events_session_id_key" ON "score_events"("session_id");
CREATE UNIQUE INDEX "score_events_streak_award_key_key" ON "score_events"("streak_award_key");
CREATE INDEX "score_events_user_id_score_date_idx" ON "score_events"("user_id", "score_date");
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "focus_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
