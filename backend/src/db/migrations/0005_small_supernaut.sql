CREATE TABLE IF NOT EXISTS "match_teammates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_participant_id" uuid NOT NULL,
	"puuid" text NOT NULL,
	"summoner_name" text NOT NULL,
	"win" boolean NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_teammates" ADD CONSTRAINT "match_teammates_match_participant_id_match_participants_id_fk" FOREIGN KEY ("match_participant_id") REFERENCES "public"."match_participants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
