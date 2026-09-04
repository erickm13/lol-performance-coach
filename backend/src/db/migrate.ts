import { migrate } from "npm:drizzle-orm@^0.36.0/postgres-js/migrator";
import { db } from "./client.ts";

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
}
