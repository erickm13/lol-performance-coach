import { and, desc, eq, isNotNull } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import {
  ingestionJobs,
  matchMetrics,
  matchParticipants,
  matchTeammates,
  matches,
  riotAccounts,
} from "../db/schema.ts";
import {
  countDeathsBefore10,
  getAccountByRiotId,
  getLeagueEntriesByPuuid,
  getMatchById,
  getMatchIdsByPuuid,
  getMatchTimeline,
  getSummonerByPuuid,
  RiotRateLimitError,
} from "./client.ts";
import { saveWeaknesses } from "../analysis/weaknesses.ts";

/**
 * La detección de debilidades es un enriquecimiento best-effort encima de un
 * sync que ya salió bien — no parte del contrato de link/sync. Si falla, se
 * loguea y se sigue: dejarla propagar hacía que `mapRiotError` cayera en su
 * rama genérica y le dijera al usuario "No pudimos conectar con Riot" cuando
 * Riot había funcionado perfecto y las partidas ya estaban guardadas.
 */
async function saveWeaknessesBestEffort(riotAccountId: string): Promise<void> {
  try {
    await saveWeaknesses(riotAccountId);
  } catch (err) {
    console.error(
      `Falló la detección de debilidades para la cuenta ${riotAccountId}:`,
      err,
    );
  }
}

async function getSoloRank(puuid: string) {
  const entries = await getLeagueEntriesByPuuid(puuid);
  const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  if (!solo) {
    return {
      soloTier: null,
      soloRank: null,
      soloLp: null,
      soloWins: null,
      soloLosses: null,
    };
  }
  return {
    soloTier: solo.tier,
    soloRank: solo.rank,
    soloLp: solo.leaguePoints,
    soloWins: solo.wins,
    soloLosses: solo.losses,
  };
}

const MATCHES_TO_FETCH = 10;
const TEAMMATE_RANK_TTL_MS = 6 * 60 * 60 * 1000;
const teammateRankCache = new Map<
  string,
  { soloTier: string | null; expiresAt: number }
>();
const teammateRankRequests = new Map<string, Promise<string | null>>();

async function getCachedTeammateSoloTier(puuid: string): Promise<string | null> {
  const cached = teammateRankCache.get(puuid);
  if (cached && cached.expiresAt > Date.now()) return cached.soloTier;

  const pending = teammateRankRequests.get(puuid);
  if (pending) return await pending;

  const request = getLeagueEntriesByPuuid(puuid)
    .then((entries) =>
      entries.find((entry) => entry.queueType === "RANKED_SOLO_5x5")?.tier ?? null
    )
    .catch((err) => {
      console.warn(`No se pudo consultar el rango de un compañero de Riot: ${err}`);
      return null;
    })
    .then((soloTier) => {
      teammateRankCache.set(puuid, {
        soloTier,
        // Evita repetir consultas; si Riot falla, reintenta después de 5 minutos.
        expiresAt: Date.now() + (soloTier ? TEAMMATE_RANK_TTL_MS : 5 * 60 * 1000),
      });
      return soloTier;
    })
    .finally(() => teammateRankRequests.delete(puuid));

  teammateRankRequests.set(puuid, request);
  return await request;
}

export class AlreadyLinkedError extends Error {}
export class PuuidTakenError extends Error {}
export class NotLinkedError extends Error {}

async function ingestMatches(riotAccountId: string, puuid: string) {
  const [job] = await db
    .insert(ingestionJobs)
    .values({
      riotAccountId,
      status: "running",
      matchesRequested: MATCHES_TO_FETCH,
      startedAt: new Date(),
    })
    .returning();

  let processed = 0;
  let jobError: string | null = null;

  try {
    const matchIds = await getMatchIdsByPuuid(puuid, MATCHES_TO_FETCH);

    for (const riotMatchId of matchIds) {
      let [matchRow] = await db
        .select()
        .from(matches)
        .where(eq(matches.riotMatchId, riotMatchId))
        .limit(1);

      if (matchRow) {
        const [existingParticipant] = await db
          .select()
          .from(matchParticipants)
          .where(
            and(
              eq(matchParticipants.matchId, matchRow.id),
              eq(matchParticipants.riotAccountId, riotAccountId),
            ),
          )
          .limit(1);
        if (existingParticipant) {
          processed++;
          continue;
        }
      }

      const detail = await getMatchById(riotMatchId);
      const participant = detail.info.participants.find((p) =>
        p.puuid === puuid
      );
      if (!participant) {
        processed++;
        continue;
      }

      if (!matchRow) {
        [matchRow] = await db
          .insert(matches)
          .values({
            riotMatchId,
            rawDetail: detail,
            patchVersion: detail.info.gameVersion,
            queueId: detail.info.queueId,
            gameCreation: new Date(detail.info.gameCreation),
            gameDurationSeconds: detail.info.gameDuration,
          })
          .returning();
      }

      if (!matchRow.rawDetail) {
        await db.update(matches).set({ rawDetail: detail }).where(eq(matches.id, matchRow.id));
      }

      const csTotal = participant.totalMinionsKilled +
        participant.neutralMinionsKilled;
      const minutes = detail.info.gameDuration / 60;
      const teamKills = detail.info.participants
        .filter((p) => p.teamId === participant.teamId)
        .reduce((sum, p) => sum + p.kills, 0);

      let deathsBefore10: number | null = null;
      try {
        const timeline = await getMatchTimeline(riotMatchId);
        deathsBefore10 = countDeathsBefore10(timeline, participant.participantId);
        await db.update(matches).set({ rawTimeline: timeline }).where(eq(matches.id, matchRow.id));
      } catch {
        deathsBefore10 = null;
      }

      const [participantRow] = await db
        .insert(matchParticipants)
        .values({
          matchId: matchRow.id,
          riotAccountId,
          puuid,
          champion: participant.championName,
          role: participant.teamPosition || null,
          teamId: participant.teamId,
          win: participant.win,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          csTotal,
          visionScore: participant.visionScore,
          goldTotal: participant.goldEarned,
          damageTotal: participant.totalDamageDealtToChampions,
          rawStats: participant,
        })
        .returning();

      await db.insert(matchMetrics).values({
        matchParticipantId: participantRow.id,
        csPerMin: csTotal / minutes,
        kda: (participant.kills + participant.assists) /
          Math.max(participant.deaths, 1),
        visionScorePerMin: participant.visionScore / minutes,
        deathsBefore10,
        goldPerMin: participant.goldEarned / minutes,
        damagePerMin: participant.totalDamageDealtToChampions / minutes,
        killParticipation: teamKills > 0
          ? (participant.kills + participant.assists) / teamKills
          : 0,
      });

      const teammates = detail.info.participants.filter(
        (p) => p.teamId === participant.teamId && p.puuid !== puuid,
      );
      if (teammates.length > 0) {
        await db.insert(matchTeammates).values(
          teammates.map((t) => ({
            matchParticipantId: participantRow.id,
            puuid: t.puuid,
            summonerName: t.riotIdGameName || "Invocador",
            profileIconId: t.profileIcon ?? null,
            win: t.win,
          })),
        );
      }

      processed++;
    }
  } catch (err) {
    jobError = err instanceof RiotRateLimitError
      ? `Rate limit alcanzado — se guardaron ${processed} de ${MATCHES_TO_FETCH} partidas`
      : err instanceof Error
      ? err.message
      : String(err);
  }

  await db
    .update(ingestionJobs)
    .set({
      status: jobError ? "error" : "done",
      matchesIngested: processed,
      finishedAt: new Date(),
      error: jobError,
    })
    .where(eq(ingestionJobs.id, job.id));

  return { processed, partial: !!jobError, error: jobError };
}

export async function linkRiotAccount(
  userId: string,
  gameName: string,
  tagLine: string,
) {
  const [existing] = await db
    .select()
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, userId))
    .limit(1);
  if (existing) {
    throw new AlreadyLinkedError("Ya tenés una cuenta de Riot vinculada");
  }

  const account = await getAccountByRiotId(gameName, tagLine);

  const [taken] = await db
    .select()
    .from(riotAccounts)
    .where(eq(riotAccounts.puuid, account.puuid))
    .limit(1);
  if (taken) {
    throw new PuuidTakenError("Esa cuenta de Riot ya está vinculada a otro usuario");
  }

  const summoner = await getSummonerByPuuid(account.puuid);
  const soloRank = await getSoloRank(account.puuid);

  const [riotAccount] = await db
    .insert(riotAccounts)
    .values({
      userId,
      puuid: account.puuid,
      summonerName: account.gameName,
      tagLine: account.tagLine,
      region: "LAN",
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      ...soloRank,
    })
    .returning();

  const result = await ingestMatches(riotAccount.id, account.puuid);
  await saveWeaknessesBestEffort(riotAccount.id);

  return {
    account: riotAccount,
    ingested: result.processed,
    partial: result.partial,
  };
}

export async function syncRiotAccount(userId: string) {
  const [riotAccount] = await db
    .select()
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, userId))
    .limit(1);
  if (!riotAccount) {
    throw new NotLinkedError("No tenés una cuenta de Riot vinculada");
  }

  const summoner = await getSummonerByPuuid(riotAccount.puuid);
  const soloRank = await getSoloRank(riotAccount.puuid);
  const [updatedAccount] = await db
    .update(riotAccounts)
    .set({
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      ...soloRank,
    })
    .where(eq(riotAccounts.id, riotAccount.id))
    .returning();

  const result = await ingestMatches(riotAccount.id, riotAccount.puuid);
  await saveWeaknessesBestEffort(riotAccount.id);

  return {
    account: updatedAccount,
    ingested: result.processed,
    partial: result.partial,
  };
}

export async function getStoredRiotAccount(userId: string) {
  const [riotAccount] = await db
    .select()
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, userId))
    .limit(1);
  if (!riotAccount) return null;

  const participants = await db
    .select()
    .from(matchParticipants)
    .where(eq(matchParticipants.riotAccountId, riotAccount.id));

  const combined = [];
  for (const p of participants) {
    const [m] = await db
      .select({ id: matches.id, riotMatchId: matches.riotMatchId, patchVersion: matches.patchVersion,
        queueId: matches.queueId, gameCreation: matches.gameCreation, gameDurationSeconds: matches.gameDurationSeconds })
      .from(matches)
      .where(eq(matches.id, p.matchId))
      .limit(1);
    const [metrics] = await db
      .select()
      .from(matchMetrics)
      .where(eq(matchMetrics.matchParticipantId, p.id))
      .limit(1);
    combined.push({ ...p, match: m, metrics });
  }

  combined.sort((a, b) =>
    (b.match?.gameCreation.getTime() ?? 0) -
    (a.match?.gameCreation.getTime() ?? 0)
  );

  const [championStats, recentTeammates, [lastSuccessfulSync]] = await Promise.all([
    getChampionStats(riotAccount.id),
    getRecentTeammates(riotAccount.id),
    db.select({ finishedAt: ingestionJobs.finishedAt })
      .from(ingestionJobs)
      .where(and(
        eq(ingestionJobs.riotAccountId, riotAccount.id),
        eq(ingestionJobs.status, "done"),
        isNotNull(ingestionJobs.finishedAt),
      ))
      .orderBy(desc(ingestionJobs.finishedAt))
      .limit(1),
  ]);

  return {
    account: riotAccount,
    matches: combined.slice(0, MATCHES_TO_FETCH),
    championStats,
    recentTeammates,
    lastSyncedAt: lastSuccessfulSync?.finishedAt ?? null,
  };
}

export async function getChampionStats(riotAccountId: string) {
  const participants = await db
    .select()
    .from(matchParticipants)
    .where(eq(matchParticipants.riotAccountId, riotAccountId));

  const byChampion = new Map<string, {
    champion: string;
    games: number;
    wins: number;
    killsSum: number;
    deathsSum: number;
    assistsSum: number;
    kdaSum: number;
  }>();

  for (const p of participants) {
    const entry = byChampion.get(p.champion) ?? {
      champion: p.champion,
      games: 0,
      wins: 0,
      killsSum: 0,
      deathsSum: 0,
      assistsSum: 0,
      kdaSum: 0,
    };
    entry.games++;
    if (p.win) entry.wins++;
    entry.killsSum += p.kills;
    entry.deathsSum += p.deaths;
    entry.assistsSum += p.assists;

    const [metrics] = await db
      .select()
      .from(matchMetrics)
      .where(eq(matchMetrics.matchParticipantId, p.id))
      .limit(1);
    entry.kdaSum += metrics?.kda ??
      (p.kills + p.assists) / Math.max(p.deaths, 1);

    byChampion.set(p.champion, entry);
  }

  return [...byChampion.values()]
    .map((c) => ({
      champion: c.champion,
      games: c.games,
      winRate: Math.round((c.wins / c.games) * 100),
      avgKills: c.killsSum / c.games,
      avgDeaths: c.deathsSum / c.games,
      avgAssists: c.assistsSum / c.games,
      avgKda: c.kdaSum / c.games,
    }))
    .sort((a, b) => b.games - a.games);
}

export async function getRecentTeammates(riotAccountId: string) {
  const participants = await db
    .select({ id: matchParticipants.id })
    .from(matchParticipants)
    .where(eq(matchParticipants.riotAccountId, riotAccountId));

  const byTeammate = new Map<
    string,
    {
      puuid: string;
      summonerName: string;
      profileIconId: number | null;
      games: number;
      wins: number;
    }
  >();

  for (const p of participants) {
    const teammates = await db
      .select()
      .from(matchTeammates)
      .where(eq(matchTeammates.matchParticipantId, p.id));

    for (const t of teammates) {
      const entry = byTeammate.get(t.puuid) ?? {
        puuid: t.puuid,
        summonerName: t.summonerName,
        profileIconId: t.profileIconId,
        games: 0,
        wins: 0,
      };
      if (entry.profileIconId == null && t.profileIconId != null) {
        entry.profileIconId = t.profileIconId;
      }
      entry.games++;
      if (t.win) entry.wins++;
      byTeammate.set(t.puuid, entry);
    }
  }

  const sortedTeammates = [...byTeammate.values()]
    .map((t) => ({ ...t, winRate: Math.round((t.wins / t.games) * 100) }))
    .sort((a, b) => b.games - a.games);

  // La tabla muestra siete jugadores; consulta solo esos PUUID y conserva sus rangos en caché.
  const topTeammates = await Promise.all(
    sortedTeammates.slice(0, 7).map(async (teammate) => ({
      ...teammate,
      soloTier: await getCachedTeammateSoloTier(teammate.puuid),
    })),
  );
  const topByPuuid = new Map(topTeammates.map((teammate) => [teammate.puuid, teammate]));

  return sortedTeammates.map((teammate) =>
    topByPuuid.get(teammate.puuid) ?? { ...teammate, soloTier: null }
  );
}
