import { Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { and, count, desc, eq, sql } from "npm:drizzle-orm@^0.36.0";
import { verifySessionToken } from "../auth/jwt.ts";
import { db } from "../db/client.ts";
import { playerProfiles, riotAccounts, users } from "../db/schema.ts";
import {
  AREA_LABELS,
  AREAS,
  parsePreferences,
  ProfileValidationError,
  readPlayerProfile,
  ROLE_LABELS,
  ROLES,
  UNIVERSITIES,
} from "../player/profile.ts";
export const playerRoutes = new Hono<{ Variables: { userId: string } }>();
playerRoutes.use("*", async (c, next) => {
  const token = getCookie(c, "session");
  const id = token ? await verifySessionToken(token) : null;
  if (!id) return c.json({ error: "No autenticado" }, 401);
  c.set("userId", id);
  await next();
});
playerRoutes.get("/profile", async (c) => {
  const [account] = await db.select({
    summonerName: riotAccounts.summonerName,
    tagLine: riotAccounts.tagLine,
    primaryRole: riotAccounts.primaryRole,
    soloTier: riotAccounts.soloTier,
    soloRank: riotAccounts.soloRank,
    soloLp: riotAccounts.soloLp,
    region: riotAccounts.region,
  }).from(riotAccounts).where(eq(riotAccounts.userId, c.get("userId"))).limit(
    1,
  );
  return c.json({
    profile: await readPlayerProfile(c.get("userId")),
    account: account ?? null,
    options: {
      roles: ROLES.map((id) => ({ id, name: ROLE_LABELS[id] })),
      areas: AREAS.map((id) => ({ id, name: AREA_LABELS[id] })),
      universities: UNIVERSITIES,
    },
  });
});
playerRoutes.put("/profile", async (c) => {
  try {
    const preferences = parsePreferences(await c.req.json().catch(() => null));
    const [profile] = await db.insert(playerProfiles).values({
      userId: c.get("userId"),
      ...preferences,
    }).onConflictDoUpdate({
      target: playerProfiles.userId,
      set: { ...preferences, updatedAt: new Date() },
    }).returning();
    return c.json({ profile });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});
playerRoutes.get("/ranking", async (c) => {
  const region = c.req.query("region") ?? "LAN";
  const university = c.req.query("university") ?? "all";
  const page = Number(c.req.query("page") ?? 1);
  if (
    ![
      "LAN",
      "LAS",
      "NA",
      "BR",
      "EUW",
      "EUNE",
      "KR",
      "JP",
      "OCE",
      "TR",
      "RU",
      "PH",
      "SG",
      "TH",
      "TW",
      "VN",
    ].includes(region) || !Number.isInteger(page) || page < 1 || page > 10000 ||
    university.length > 120
  ) return c.json({ error: "Filtros de ranking inválidos" }, 400);
  const tierOrder = sql<
    number
  >`case ${riotAccounts.soloTier} when 'CHALLENGER' then 10 when 'GRANDMASTER' then 9 when 'MASTER' then 8 when 'DIAMOND' then 7 when 'EMERALD' then 6 when 'PLATINUM' then 5 when 'GOLD' then 4 when 'SILVER' then 3 when 'BRONZE' then 2 when 'IRON' then 1 else 0 end`;
  const divisionOrder = sql<
    number
  >`case ${riotAccounts.soloRank} when 'I' then 4 when 'II' then 3 when 'III' then 2 when 'IV' then 1 else 0 end`;
  const conditions = [
    eq(playerProfiles.rankingVisible, true),
    eq(users.emailVerified, true),
    eq(riotAccounts.region, region),
    sql`${tierOrder} > 0`,
  ];
  if (university !== "all") {
    conditions.push(eq(playerProfiles.universityKey, university));
  }
  const filter = and(...conditions);
  const [totals] = await db.select({ total: count() }).from(playerProfiles)
    .innerJoin(users, eq(users.id, playerProfiles.userId)).innerJoin(
      riotAccounts,
      eq(riotAccounts.userId, playerProfiles.userId),
    ).where(filter);
  const pages = Math.ceil(totals.total / 20),
    current = Math.min(page, Math.max(1, pages));
  const rows = await db.select({
    summonerName: riotAccounts.summonerName,
    tagLine: riotAccounts.tagLine,
    profileIconId: riotAccounts.profileIconId,
    tier: riotAccounts.soloTier,
    division: riotAccounts.soloRank,
    lp: riotAccounts.soloLp,
    wins: riotAccounts.soloWins,
    losses: riotAccounts.soloLosses,
    updatedAt: riotAccounts.rankUpdatedAt,
    university: playerProfiles.universityName,
    self: sql<boolean>`${playerProfiles.userId} = ${c.get("userId")}`,
  }).from(playerProfiles).innerJoin(users, eq(users.id, playerProfiles.userId))
    .innerJoin(riotAccounts, eq(riotAccounts.userId, playerProfiles.userId))
    .where(filter).orderBy(
      desc(tierOrder),
      desc(divisionOrder),
      desc(riotAccounts.soloLp),
      riotAccounts.summonerName,
      riotAccounts.id,
    ).limit(20).offset((current - 1) * 20);
  const universities = await db.select({
    id: playerProfiles.universityKey,
    name: sql<string>`min(${playerProfiles.universityName})`,
  }).from(playerProfiles).innerJoin(users, eq(users.id, playerProfiles.userId))
    .innerJoin(riotAccounts, eq(riotAccounts.userId, playerProfiles.userId))
    .where(
      and(
        eq(playerProfiles.rankingVisible, true),
        eq(users.emailVerified, true),
        eq(riotAccounts.region, region),
        sql`${tierOrder} > 0`,
        sql`${playerProfiles.universityKey} is not null`,
      ),
    ).groupBy(playerProfiles.universityKey)
    .orderBy(sql`min(${playerProfiles.universityName})`);
  return c.json({
    rows: rows.map((row, index) => ({
      ...row,
      position: (current - 1) * 20 + index + 1,
    })),
    universities,
    region,
    queue: "RANKED_SOLO_5x5",
    pagination: { page: current, pages, total: totals.total },
  });
});
