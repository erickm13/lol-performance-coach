import { Hono } from "jsr:@hono/hono@^4.6.0";
import { cors } from "jsr:@hono/hono@^4.6.0/cors";
import { db } from "./db/client.ts";
import { sql } from "npm:drizzle-orm@^0.36.0";
import { createAuthRoutes } from "./routes/auth.ts";
import { riotRoutes } from "./routes/riot.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { matchRoutes } from "./routes/matches.ts";
import { trainingRoutes } from "./routes/training.ts";
import { preparationRoutes } from "./routes/preparation.ts";
import { liveDraftRoutes } from "./routes/liveDraft.ts";
import { playerRoutes } from "./routes/player.ts";
import { aiRoutes } from "./routes/ai.ts";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email/mailer.ts";

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: Deno.env.get("FRONTEND_URL") ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.route("/auth", createAuthRoutes({ sendVerificationEmail, sendPasswordResetEmail }));
app.route("/riot", riotRoutes);
app.route("/riot", trainingRoutes);
app.route("/riot", matchRoutes);
app.route("/settings", settingsRoutes);
app.route("/ai", aiRoutes);
app.route("/player", playerRoutes);
app.route("/preparation/live", liveDraftRoutes);
app.route("/preparation", preparationRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Error interno del servidor" }, 500);
});

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
