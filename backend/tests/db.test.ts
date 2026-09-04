import { assertEquals } from "jsr:@std/assert@^1.0.0";
import postgres from "npm:postgres@^3.4.4";
import { runMigrations } from "../src/db/migrate.ts";

Deno.test("runMigrations crea las 10 tablas del modelo entidad-relación", async () => {
  await runMigrations();

  const connectionString = Deno.env.get("DATABASE_URL")!;
  const sql = postgres(connectionString);
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `;
  const tableNames = rows.map((row) => row.table_name);

  assertEquals(tableNames, [
    "ingestion_jobs",
    "match_metrics",
    "match_participants",
    "matches",
    "plan_progress",
    "riot_accounts",
    "training_plan_items",
    "training_plans",
    "users",
    "weaknesses",
  ]);

  await sql.end();
});
