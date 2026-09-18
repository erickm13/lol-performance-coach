import { Context, Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { eq, sql } from "npm:drizzle-orm@^0.36.0";
import { verifySessionToken } from "../auth/jwt.ts";
import { db } from "../db/client.ts";
import { riotAccounts, weaknesses, trainingPlans, trainingPlanItems } from "../db/schema.ts";
import {
  generateTrainingPlan,
  getCurrentTrainingPlan,
  markItemProgress,
} from "../analysis/trainingPlan.ts";

const SESSION_COOKIE = "session";

async function requireUserId(c: Context): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  return token ? await verifySessionToken(token) : null;
}

async function getRiotAccountId(userId: string): Promise<string | null> {
  const [account] = await db
    .select({ id: riotAccounts.id })
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, userId))
    .limit(1);
  return account?.id ?? null;
}

async function verifyItemOwnership(itemId: string, riotAccountId: string): Promise<boolean> {
  const [item] = await db
    .select({ trainingPlanId: trainingPlanItems.trainingPlanId })
    .from(trainingPlanItems)
    .where(eq(trainingPlanItems.id, itemId))
    .limit(1);

  if (!item) return false;

  const [plan] = await db
    .select({ riotAccountId: trainingPlans.riotAccountId })
    .from(trainingPlans)
    .where(eq(trainingPlans.id, item.trainingPlanId))
    .limit(1);

  return plan ? plan.riotAccountId === riotAccountId : false;
}

export const trainingRoutes = new Hono();

trainingRoutes.get("/weaknesses", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const riotAccountId = await getRiotAccountId(userId);
  if (!riotAccountId) return c.json({ weaknesses: [] });

  const rows = await db
    .select()
    .from(weaknesses)
    .where(eq(weaknesses.riotAccountId, riotAccountId))
    .orderBy(sql`case ${weaknesses.severity}
      when 'high' then 0
      when 'medium' then 1
      when 'low' then 2
      else 3
    end`);
  return c.json({ weaknesses: rows });
});

trainingRoutes.get("/training-plan", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const riotAccountId = await getRiotAccountId(userId);
  if (!riotAccountId) return c.json({ plan: null, items: [] });

  const result = await getCurrentTrainingPlan(riotAccountId);
  return c.json(result);
});

trainingRoutes.post("/training-plan", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const riotAccountId = await getRiotAccountId(userId);
  if (!riotAccountId) {
    return c.json({ error: "No tenés una cuenta de Riot vinculada" }, 404);
  }

  const result = await generateTrainingPlan(riotAccountId);
  return c.json(result, 201);
});

trainingRoutes.post("/training-plan/items/:itemId/progress", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const riotAccountId = await getRiotAccountId(userId);
  if (!riotAccountId) {
    return c.json({ error: "No tenés una cuenta de Riot vinculada" }, 404);
  }

  const itemId = c.req.param("itemId");
  const isOwner = await verifyItemOwnership(itemId, riotAccountId);
  if (!isOwner) {
    return c.json({ error: "Ítem no encontrado" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const progress = await markItemProgress(itemId, {
    selfRating: typeof body.selfRating === "number" ? body.selfRating : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
  });
  return c.json(progress, 201);
});
