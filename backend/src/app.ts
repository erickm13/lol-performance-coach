import { Hono } from "jsr:@hono/hono@^4.6.0";
import { cors } from "jsr:@hono/hono@^4.6.0/cors";
import { db } from "./db/client.ts";
import { sql } from "npm:drizzle-orm@^0.36.0";
import { createAuthRoutes } from "./routes/auth.ts";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email/resend.ts";

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: Deno.env.get("FRONTEND_URL") ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.route("/auth", createAuthRoutes({ sendVerificationEmail, sendPasswordResetEmail }));

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
