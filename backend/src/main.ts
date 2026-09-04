import { app } from "./app.ts";
import { runMigrations } from "./db/migrate.ts";

await runMigrations();

const port = Number(Deno.env.get("PORT") ?? "8000");
console.log(`Backend escuchando en http://localhost:${port}`);
Deno.serve({ port }, app.fetch);
