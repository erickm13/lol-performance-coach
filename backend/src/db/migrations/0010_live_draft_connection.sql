CREATE TABLE IF NOT EXISTS "live_draft_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone,
	"snapshot" jsonb,
	CONSTRAINT "live_draft_connections_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_draft_connections" ADD CONSTRAINT "live_draft_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
