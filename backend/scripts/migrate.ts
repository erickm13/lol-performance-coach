import { runMigrations } from "../src/db/migrate.ts";

await runMigrations();
console.log("Migraciones aplicadas correctamente");
Deno.exit(0);
