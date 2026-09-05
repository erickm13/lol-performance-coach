import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { getTableName } from "npm:drizzle-orm@^0.36.0";
import {
  users,
  riotAccounts,
  ingestionJobs,
  matches,
  matchParticipants,
  matchMetrics,
  weaknesses,
  trainingPlans,
  trainingPlanItems,
  planProgress,
  authTokens,
} from "../src/db/schema.ts";

Deno.test("el esquema exporta las 10 tablas del MER con el nombre correcto", () => {
  assertEquals(getTableName(users), "users");
  assertEquals(getTableName(riotAccounts), "riot_accounts");
  assertEquals(getTableName(ingestionJobs), "ingestion_jobs");
  assertEquals(getTableName(matches), "matches");
  assertEquals(getTableName(matchParticipants), "match_participants");
  assertEquals(getTableName(matchMetrics), "match_metrics");
  assertEquals(getTableName(weaknesses), "weaknesses");
  assertEquals(getTableName(trainingPlans), "training_plans");
  assertEquals(getTableName(trainingPlanItems), "training_plan_items");
  assertEquals(getTableName(planProgress), "plan_progress");
});

Deno.test("el esquema exporta la tabla auth_tokens", () => {
  assertEquals(getTableName(authTokens), "auth_tokens");
});
