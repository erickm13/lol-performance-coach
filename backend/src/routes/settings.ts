import { Hono } from "jsr:@hono/hono@^4.6.0";
import { deleteCookie, getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { and, eq, inArray, notExists } from "npm:drizzle-orm@^0.36.0";
import { verifySessionToken } from "../auth/jwt.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { db } from "../db/client.ts";
import {
  authTokens,
  ingestionJobs,
  matches,
  matchMetrics,
  matchParticipants,
  matchTeammates,
  planProgress,
  riotAccounts,
  trainingPlanItems,
  trainingPlans,
  users,
  weaknesses,
} from "../db/schema.ts";

export const settingsRoutes = new Hono<{ Variables: { userId: string } }>();
settingsRoutes.use("*", async (c, next) => {
  const token = getCookie(c, "session");
  const userId = token ? await verifySessionToken(token) : null;
  if (!userId) return c.json({ error: "No autenticado" }, 401);
  c.set("userId", userId);
  await next();
});

settingsRoutes.get("/profile", async (c) => {
  const [user] = await db.select({
    email: users.email,
    emailVerified: users.emailVerified,
  }).from(users).where(eq(users.id, c.get("userId"))).limit(1);
  if (!user) return c.json({ error: "No autenticado" }, 401);
  const [account] = await db.select({
    summonerName: riotAccounts.summonerName,
    tagLine: riotAccounts.tagLine,
    region: riotAccounts.region,
    linkedAt: riotAccounts.linkedAt,
    profileIconId: riotAccounts.profileIconId,
  }).from(riotAccounts).where(eq(riotAccounts.userId, c.get("userId"))).limit(
    1,
  );
  return c.json({ user, account: account ?? null });
});

class SynchronizationInProgress extends Error {}

async function removeData(userId: string, removeUser: boolean) {
  await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId))
      .for("update");
    const accounts = await tx.select({ id: riotAccounts.id }).from(riotAccounts)
      .where(eq(riotAccounts.userId, userId)).for("update");
    for (const account of accounts) {
      const [running] = await tx.select({ id: ingestionJobs.id }).from(
        ingestionJobs,
      ).where(
        and(
          eq(ingestionJobs.riotAccountId, account.id),
          eq(ingestionJobs.status, "running"),
        ),
      ).limit(1);
      if (running) throw new SynchronizationInProgress();
      const plans = await tx.select({ id: trainingPlans.id }).from(
        trainingPlans,
      ).where(eq(trainingPlans.riotAccountId, account.id));
      if (plans.length) {
        const planIds = plans.map((p) => p.id);
        const items = await tx.select({ id: trainingPlanItems.id }).from(
          trainingPlanItems,
        ).where(inArray(trainingPlanItems.trainingPlanId, planIds));
        if (items.length) {
          await tx.delete(planProgress).where(
            inArray(planProgress.trainingPlanItemId, items.map((i) => i.id)),
          );
        }
        await tx.delete(trainingPlanItems).where(
          inArray(trainingPlanItems.trainingPlanId, planIds),
        );
        await tx.delete(trainingPlans).where(
          inArray(trainingPlans.id, planIds),
        );
      }
      const participants = await tx.select({
        id: matchParticipants.id,
        matchId: matchParticipants.matchId,
      }).from(matchParticipants).where(
        eq(matchParticipants.riotAccountId, account.id),
      );
      if (participants.length) {
        const ids = participants.map((p) => p.id);
        await tx.delete(matchTeammates).where(
          inArray(matchTeammates.matchParticipantId, ids),
        );
        await tx.delete(matchMetrics).where(
          inArray(matchMetrics.matchParticipantId, ids),
        );
        await tx.delete(matchParticipants).where(
          inArray(matchParticipants.id, ids),
        );
        // A shared match belongs to other accounts too; remove only orphaned cache rows.
        await tx.delete(matches).where(
          and(
            inArray(
              matches.id,
              participants.map((p) => p.matchId),
            ),
            notExists(
              tx.select({ id: matchParticipants.id }).from(matchParticipants)
                .where(eq(matchParticipants.matchId, matches.id)),
            ),
          ),
        );
      }
      await tx.delete(weaknesses).where(
        eq(weaknesses.riotAccountId, account.id),
      );
      await tx.delete(ingestionJobs).where(
        eq(ingestionJobs.riotAccountId, account.id),
      );
      await tx.delete(riotAccounts).where(eq(riotAccounts.id, account.id));
    }
    if (removeUser) {
      await tx.delete(authTokens).where(eq(authTokens.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    }
  });
}

settingsRoutes.post("/change-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (
    typeof body?.currentPassword !== "string" ||
    typeof body?.newPassword !== "string" ||
    body.newPassword.length < 8
  ) {
    return c.json({
      error: "La nueva contraseña debe tener al menos 8 caracteres",
    }, 400);
  }
  if (new TextEncoder().encode(body.newPassword).length > 72) {
    return c.json({
      error: "La nueva contraseña es demasiado larga. Usá una más corta.",
    }, 400);
  }
  const [user] = await db.select().from(users).where(
    eq(users.id, c.get("userId")),
  ).limit(1);
  if (!user) return c.json({ error: "No autenticado" }, 401);
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    return c.json({ error: "La contraseña actual es incorrecta" }, 403);
  }
  if (body.currentPassword === body.newPassword) {
    return c.json({ error: "Elegí una contraseña diferente" }, 400);
  }
  const passwordHash = await hashPassword(body.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await tx.delete(authTokens).where(
      and(
        eq(authTokens.userId, user.id),
        eq(authTokens.type, "password_reset"),
      ),
    );
  });
  return c.json({ ok: true });
});

settingsRoutes.delete("/riot-account", async (c) => {
  const body = await c.req.json().catch(() => null);
  const [user] = await db.select().from(users).where(
    eq(users.id, c.get("userId")),
  ).limit(1);
  if (!user) return c.json({ error: "No autenticado" }, 401);
  if (
    typeof body?.password !== "string" ||
    !(await verifyPassword(body.password, user.passwordHash))
  ) {
    return c.json({ error: "Ingresá tu contraseña para confirmar" }, 403);
  }
  try {
    await removeData(user.id, false);
  } catch (error) {
    if (error instanceof SynchronizationInProgress) {
      return c.json({
        error:
          "Esperá a que termine la sincronización de partidas antes de desvincular Riot",
      }, 409);
    }
    throw error;
  }
  return c.json({ ok: true });
});

settingsRoutes.delete("/account", async (c) => {
  const body = await c.req.json().catch(() => null);
  const [user] = await db.select().from(users).where(
    eq(users.id, c.get("userId")),
  ).limit(1);
  if (!user) return c.json({ error: "No autenticado" }, 401);
  if (
    body?.confirmation !== "ELIMINAR" || typeof body?.password !== "string" ||
    !(await verifyPassword(body.password, user.passwordHash))
  ) {
    return c.json(
      { error: "Confirmá con tu contraseña y la palabra ELIMINAR" },
      403,
    );
  }
  try {
    await removeData(user.id, true);
  } catch (error) {
    if (error instanceof SynchronizationInProgress) {
      return c.json({
        error:
          "Esperá a que termine la sincronización de partidas antes de eliminar tu cuenta",
      }, 409);
    }
    throw error;
  }
  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});
