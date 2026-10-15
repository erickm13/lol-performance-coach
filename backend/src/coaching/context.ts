import { and, desc, eq, sql } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import {
  matches,
  matchMetrics,
  matchParticipants,
  planProgress,
  playerProfiles,
  riotAccounts,
  trainingPlanItems,
  trainingPlans,
  weaknesses,
} from "../db/schema.ts";
import { RULES_VERSION, saveWeaknesses } from "../analysis/weaknesses.ts";
import { coachPreferences } from "../player/profile.ts";
export async function playerCoachingContext(userId: string, matchId?: string) {
  const [profile] = await db.select().from(playerProfiles).where(
    eq(playerProfiles.userId, userId),
  ).limit(1);
  const [account] = await db.select({
    id: riotAccounts.id,
    name: riotAccounts.summonerName,
    tier: riotAccounts.soloTier,
    division: riotAccounts.soloRank,
    lp: riotAccounts.soloLp,
    rankUpdatedAt: riotAccounts.rankUpdatedAt,
    analysisVersion: riotAccounts.analysisVersion,
    region: riotAccounts.region,
  }).from(riotAccounts).where(eq(riotAccounts.userId, userId)).limit(1);
  const preferences = coachPreferences(profile ?? null);
  if (!account) {
    return {
      preferences,
      account: null,
      sample: [],
      weaknesses: [],
      match: null,
      roleSummary: [],
    };
  }
  const fields = {
    id: matches.id,
    champion: matchParticipants.champion,
    role: matchParticipants.role,
    win: matchParticipants.win,
    kills: matchParticipants.kills,
    deaths: matchParticipants.deaths,
    assists: matchParticipants.assists,
    queue: matches.queueId,
    playedAt: matches.gameCreation,
    csPerMin: matchMetrics.csPerMin,
    visionPerMin: matchMetrics.visionScorePerMin,
    kda: matchMetrics.kda,
    participation: matchMetrics.killParticipation,
  };
  const sample = await db.select(fields).from(matchParticipants).innerJoin(
    matches,
    eq(matches.id, matchParticipants.matchId),
  ).leftJoin(
    matchMetrics,
    eq(matchMetrics.matchParticipantId, matchParticipants.id),
  ).where(eq(matchParticipants.riotAccountId, account.id)).orderBy(
    desc(matches.gameCreation),
  ).limit(10);
  let match = null;
  if (matchId) {
    const [owned] = await db.select(fields).from(matchParticipants).innerJoin(
      matches,
      eq(matches.id, matchParticipants.matchId),
    ).leftJoin(
      matchMetrics,
      eq(matchMetrics.matchParticipantId, matchParticipants.id),
    ).where(
      and(
        eq(matchParticipants.riotAccountId, account.id),
        eq(matches.id, matchId),
      ),
    ).limit(1);
    match = owned ?? null;
  }
  if (account.analysisVersion !== RULES_VERSION) {
    await saveWeaknesses(account.id);
    if (sample.length === 10 && sample.every((row) => row.csPerMin !== null)) {
      account.analysisVersion = RULES_VERSION;
    }
  }
  const patterns = await db.select({
    category: weaknesses.category,
    description: weaknesses.description,
    severity: weaknesses.severity,
  }).from(weaknesses).where(eq(weaknesses.riotAccountId, account.id)).limit(5);
  const [latestPlan] = await db.select().from(trainingPlans).where(
    and(
      eq(trainingPlans.riotAccountId, account.id),
      eq(trainingPlans.status, "active"),
    ),
  ).orderBy(desc(trainingPlans.weekStart)).limit(1);
  const planItems = latestPlan
    ? await db.select({
      title: trainingPlanItems.title,
      description: trainingPlanItems.description,
      type: trainingPlanItems.type,
      completed: sql<
        boolean
      >`exists (select 1 from ${planProgress} where ${planProgress.trainingPlanItemId} = ${trainingPlanItems.id})`,
    }).from(trainingPlanItems).where(
      eq(trainingPlanItems.trainingPlanId, latestPlan.id),
    ).orderBy(trainingPlanItems.position).limit(12)
    : [];
  const plan = latestPlan
    ? {
      weekStart: latestPlan.weekStart,
      weekEnd: latestPlan.weekEnd,
      items: planItems,
    }
    : null;
  const roleSummary = [...new Set(sample.map((row) => row.role ?? "Sin rol"))]
    .map((role) => {
      const rows = sample.filter((r) => (r.role ?? "Sin rol") === role);
      const metricRows = rows.filter((r) => r.csPerMin !== null);
      return {
        role,
        games: rows.length,
        metricGames: metricRows.length,
        csPerMin: metricRows.length
          ? Number(
            (metricRows.reduce((sum, row) => sum + row.csPerMin!, 0) /
              metricRows.length).toFixed(1),
          )
          : null,
      };
    });
  return {
    preferences,
    account,
    sample,
    weaknesses: patterns,
    match,
    roleSummary,
    plan,
  };
}
export async function compactCoachContext(userId: string) {
  const [profile] = await db.select().from(playerProfiles).where(
    eq(playerProfiles.userId, userId),
  ).limit(1);
  return coachPreferences(profile ?? null);
}
