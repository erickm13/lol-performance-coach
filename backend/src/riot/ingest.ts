import { and, eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import {
  ingestionJobs,
  matchMetrics,
  matchParticipants,
  matches,
  riotAccounts,
} from "../db/schema.ts";
import {
  getAccountByRiotId,
  getLeagueEntriesByPuuid,
  getMatchById,
  getMatchIdsByPuuid,
  getSummonerByPuuid,
  RiotRateLimitError,
} from "./client.ts";

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
            patchVersion: detail.info.gameVersion,
            queueId: detail.info.queueId,
            gameCreation: new Date(detail.info.gameCreation),
            gameDurationSeconds: detail.info.gameDuration,
          })
          .returning();
      }

      const csTotal = participant.totalMinionsKilled +
        participant.neutralMinionsKilled;
      const minutes = detail.info.gameDuration / 60;
      const teamKills = detail.info.participants
        .filter((p) => p.teamId === participant.teamId)
        .reduce((sum, p) => sum + p.kills, 0);

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
        goldPerMin: participant.goldEarned / minutes,
        damagePerMin: participant.totalDamageDealtToChampions / minutes,
        killParticipation: teamKills > 0
          ? (participant.kills + participant.assists) / teamKills
          : 0,
      });

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
      .select()
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

  return {
    account: riotAccount,
    matches: combined.slice(0, MATCHES_TO_FETCH),
  };
}
