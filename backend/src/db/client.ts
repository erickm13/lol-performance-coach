import { drizzle } from "npm:drizzle-orm@^0.36.0/postgres-js";
import postgres from "npm:postgres@^3.4.4";
import * as schema from "./schema.ts";

const connectionString = Deno.env.get("DATABASE_URL");
if (!connectionString) {
  throw new Error("La variable de entorno DATABASE_URL es requerida");
}

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
