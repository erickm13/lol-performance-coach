import { Hono } from "jsr:@hono/hono@^4.6.0";
import { db } from "./db/client.ts";
import { sql } from "npm:drizzle-orm@^0.36.0";

export const app = new Hono();

app.get("/health", async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ status: "ok", db: "connected" });
  } catch (error) {
    return c.json(
      { status: "error", db: "disconnected", message: String(error) },
      503,
    );
  }
});
