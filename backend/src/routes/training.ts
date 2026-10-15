import { Context, Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { and, desc, eq, inArray, sql } from "npm:drizzle-orm@^0.36.0";
import { verifySessionToken } from "../auth/jwt.ts";
import { db } from "../db/client.ts";
import {
  matches,
  matchMetrics,
  matchParticipants,
  riotAccounts,
  trainingPlanItems,
  trainingPlans,
  weaknesses,
} from "../db/schema.ts";
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifyItemOwnership(
  itemId: string,
  riotAccountId: string,
): Promise<boolean> {
  // Un itemId que no es UUID llegaría a Postgres como cast a uuid, tiraría un
  // error de sintaxis y saldría como 500. Para el cliente es indistinguible de
  // un ítem inexistente, así que lo tratamos igual: no encontrado.
  if (!UUID_RE.test(itemId)) return false;

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
  if (!riotAccountId) {
    return c.json({
      weaknesses: [],
      linked: false,
      sample: { count: 0, required: 10 },
    });
  }

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
  // Evidence stores participant IDs, not public match IDs. Resolve only rows
  // owned by this account; never expose another account's evidence or raw data.
  const evidenceIds = [
    ...new Set(
      rows.flatMap((row) =>
        Array.isArray(row.evidence)
          ? row.evidence.filter((id): id is string =>
            typeof id === "string" && UUID_RE.test(id)
          )
          : []
      ),
    ),
  ];
  const evidence = evidenceIds.length
    ? await db.select({
      participantId: matchParticipants.id,
      matchId: matches.id,
      champion: matchParticipants.champion,
      win: matchParticipants.win,
      playedAt: matches.gameCreation,
    }).from(matchParticipants).innerJoin(
      matches,
      eq(matches.id, matchParticipants.matchId),
    )
      .where(
        and(
          eq(matchParticipants.riotAccountId, riotAccountId),
          inArray(matchParticipants.id, evidenceIds),
        ),
      )
    : [];
  const byId = new Map(evidence.map((item) => [item.participantId, item]));
  // Same ten-row window as the detector, including its handling of missing metrics.
  const recent = await db.select({ metricId: matchMetrics.id }).from(
    matchParticipants,
  )
    .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
    .leftJoin(
      matchMetrics,
      eq(matchMetrics.matchParticipantId, matchParticipants.id),
    )
    .where(eq(matchParticipants.riotAccountId, riotAccountId))
    .orderBy(desc(matches.gameCreation)).limit(10);
  return c.json({
    linked: true,
    sample: {
      count: recent.filter((item) => item.metricId).length,
      required: 10,
    },
    weaknesses: rows.map((row) => ({
      ...row,
      evidenceMatches: Array.isArray(row.evidence)
        ? row.evidence.flatMap((id) =>
          typeof id === "string" && byId.has(id) ? [byId.get(id)!] : []
        )
        : [],
    })),
  });
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
    selfRating: typeof body.selfRating === "number"
      ? body.selfRating
      : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
  });
  return c.json(progress, 201);
});
