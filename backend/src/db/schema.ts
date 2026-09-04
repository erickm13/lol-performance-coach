import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  boolean,
  real,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const riotAccounts = pgTable("riot_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  puuid: text("puuid").notNull().unique(),
  summonerName: text("summoner_name").notNull(),
  tagLine: text("tag_line").notNull(),
  region: text("region").notNull(),
  primaryRole: text("primary_role"),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  riotAccountId: uuid("riot_account_id").notNull().references(() => riotAccounts.id),
  status: text("status").notNull().default("pending"),
  matchesRequested: integer("matches_requested").notNull(),
  matchesIngested: integer("matches_ingested").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
});

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  riotMatchId: text("riot_match_id").notNull().unique(),
  patchVersion: text("patch_version"),
  queueId: integer("queue_id"),
  gameCreation: timestamp("game_creation", { withTimezone: true }).notNull(),
  gameDurationSeconds: integer("game_duration_seconds").notNull(),
});

export const matchParticipants = pgTable("match_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matches.id),
  riotAccountId: uuid("riot_account_id").references(() => riotAccounts.id),
  puuid: text("puuid").notNull(),
  champion: text("champion").notNull(),
  role: text("role"),
  teamId: integer("team_id").notNull(),
  win: boolean("win").notNull(),
  kills: integer("kills").notNull(),
  deaths: integer("deaths").notNull(),
  assists: integer("assists").notNull(),
  csTotal: integer("cs_total").notNull(),
  visionScore: integer("vision_score").notNull(),
  goldTotal: integer("gold_total").notNull(),
  damageTotal: integer("damage_total").notNull(),
  rawStats: jsonb("raw_stats"),
});

export const matchMetrics = pgTable("match_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchParticipantId: uuid("match_participant_id")
    .notNull()
    .unique()
    .references(() => matchParticipants.id),
  csPerMin: real("cs_per_min").notNull(),
  kda: real("kda").notNull(),
  visionScorePerMin: real("vision_score_per_min").notNull(),
  deathsBefore10: integer("deaths_before_10").notNull(),
  goldPerMin: real("gold_per_min").notNull(),
  damagePerMin: real("damage_per_min").notNull(),
  killParticipation: real("kill_participation").notNull(),
  extra: jsonb("extra"),
});

export const weaknesses = pgTable("weaknesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  riotAccountId: uuid("riot_account_id").notNull().references(() => riotAccounts.id),
  category: text("category").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  evidence: jsonb("evidence").notNull(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trainingPlans = pgTable("training_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  riotAccountId: uuid("riot_account_id").notNull().references(() => riotAccounts.id),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  status: text("status").notNull().default("active"),
  generatedBy: text("generated_by").notNull(),
});

export const trainingPlanItems = pgTable("training_plan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  trainingPlanId: uuid("training_plan_id").notNull().references(() => trainingPlans.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  llmExplanation: text("llm_explanation"),
  evidenceMetricRefs: jsonb("evidence_metric_refs"),
});

export const planProgress = pgTable("plan_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  trainingPlanItemId: uuid("training_plan_item_id")
    .notNull()
    .references(() => trainingPlanItems.id),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  selfRating: integer("self_rating"),
  note: text("note"),
});
