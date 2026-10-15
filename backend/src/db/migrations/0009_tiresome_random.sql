CREATE TABLE IF NOT EXISTS "player_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"primary_role" text,
	"secondary_role" text,
	"champions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"experience" text,
	"improvement_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weekly_minutes" integer,
	"university_name" text,
	"university_key" text,
	"ranking_visible" boolean DEFAULT false NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "riot_accounts" ADD COLUMN "analysis_version" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "riot_accounts" ADD COLUMN "rank_updated_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
