import { compactCoachContext } from "../coaching/context.ts";
import { Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { and, count, desc, eq, inArray, sql } from "npm:drizzle-orm@^0.36.0";
import { verifySessionToken } from "../auth/jwt.ts";
import { LlmError } from "../analysis/llm.ts";
import { db } from "../db/client.ts";
import {
  matches,
  matchMetrics,
  matchParticipants,
  riotAccounts,
} from "../db/schema.ts";
import {
  getMatchById,
  getMatchTimeline,
  type RiotMatch,
  type RiotMatchTimeline,
} from "../riot/client.ts";

import {
  explainMapMoments,
  MAP_INSIGHTS_VERSION,
  type MapInsights,
  mergeMapInsights,
  playerMapEvents,
  reviewedEventIndexes,
} from "../analysis/matchMap.ts";

export const matchRoutes = new Hono<{ Variables: { userId: string } }>();
matchRoutes.use("*", async (c, next) => {
  const token = getCookie(c, "session");
  const userId = token ? await verifySessionToken(token) : null;
  if (!userId) return c.json({ error: "No autenticado" }, 401);
  c.set("userId", userId);
  await next();
});

matchRoutes.get("/matches", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 10);
  const result = c.req.query("result") ?? "all";
  const queue = c.req.query("queue") ?? "all";
  if (
    !Number.isInteger(page) || page < 1 || page > 100000 ||
    !Number.isInteger(limit) || limit < 1 || limit > 50 ||
    !["all", "win", "loss"].includes(result) ||
    !["all", "solo", "flex", "normal", "aram"].includes(queue)
  ) {
    return c.json({ error: "Filtros o paginación inválidos" }, 400);
  }
  const [account] = await db.select().from(riotAccounts)
    .where(eq(riotAccounts.userId, c.get("userId"))).limit(1);
  if (!account) {
    return c.json({
      matches: [],
      pagination: { page: 1, limit, total: 0, pages: 0 },
      linked: false,
      storedTotal: 0,
      summary: {
        wins: 0,
        losses: 0,
        winRate: 0,
        averageKda: null,
        averageCsPerMin: null,
        metricsCount: 0,
      },
    });
  }
  const conditions = [eq(matchParticipants.riotAccountId, account.id)];
  if (result !== "all") {
    conditions.push(eq(matchParticipants.win, result === "win"));
  }
  const queueIds: Record<string, number[]> = {
    solo: [420],
    flex: [440],
    normal: [400, 430, 490],
    aram: [450],
  };
  if (queue !== "all") {
    conditions.push(inArray(matches.queueId, queueIds[queue]));
  }
  const filter = and(...conditions);
  const [totals] = await db.select({
    total: count(),
    wins: sql<number>`count(*) filter (where ${matchParticipants.win})`.mapWith(
      Number,
    ),
    averageKda: sql<number | null>`avg(${matchMetrics.kda})`.mapWith(Number),
    averageCsPerMin: sql<number | null>`avg(${matchMetrics.csPerMin})`.mapWith(
      Number,
    ),
    metricsCount: count(matchMetrics.id),
  }).from(matchParticipants)
    .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
    .leftJoin(
      matchMetrics,
      eq(matchMetrics.matchParticipantId, matchParticipants.id),
    ).where(
      filter,
    );
  const [stored] = await db.select({ total: count() }).from(matchParticipants)
    .where(eq(matchParticipants.riotAccountId, account.id));
  const pages = Math.ceil(totals.total / limit);
  const currentPage = Math.min(page, Math.max(1, pages));
  const rows = await db.select({
    participant: matchParticipants,
    match: {
      id: matches.id,
      riotMatchId: matches.riotMatchId,
      queueId: matches.queueId,
      gameCreation: matches.gameCreation,
      gameDurationSeconds: matches.gameDurationSeconds,
      patchVersion: matches.patchVersion,
    },
    metrics: matchMetrics,
  }).from(matchParticipants)
    .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
    .leftJoin(
      matchMetrics,
      eq(matchMetrics.matchParticipantId, matchParticipants.id),
    )
    .where(filter).orderBy(desc(matches.gameCreation), desc(matches.id))
    .limit(limit).offset((currentPage - 1) * limit);
  return c.json({
    matches: rows.map(({ participant, ...rest }) => ({
      ...participant,
      ...rest,
    })),
    pagination: { page: currentPage, limit, total: totals.total, pages },
    linked: true,
    storedTotal: stored.total,
    summary: {
      wins: totals.wins,
      losses: totals.total - totals.wins,
      winRate: totals.total ? totals.wins / totals.total * 100 : 0,
      averageKda: totals.averageKda,
      averageCsPerMin: totals.averageCsPerMin,
      metricsCount: totals.metricsCount,
    },
  });
});

// Serialize legacy cache enrichment so simultaneous visits do not multiply Riot calls.
const enrichments = new Map<string, Promise<void>>();
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: AbortSignal.timeout(8000),
  });
async function enrich(
  id: string,
  riotMatchId: string,
  detailMissing: boolean,
  timelineMissing: boolean,
) {
  const pending = enrichments.get(id);
  if (pending) return await pending;
  const request = (async () => {
    // Sequential requests respect the same API limits used by synchronization.
    if (detailMissing) {
      try {
        const rawDetail = await getMatchById(riotMatchId, fetchWithTimeout);
        await db.update(matches).set({ rawDetail }).where(eq(matches.id, id));
      } catch (error) {
        console.warn(
          "No se pudo ampliar el detalle de partida:",
          String(error),
        );
      }
    }
    if (timelineMissing) {
      try {
        const rawTimeline = await getMatchTimeline(
          riotMatchId,
          fetchWithTimeout,
        );
        await db.update(matches).set({ rawTimeline }).where(eq(matches.id, id));
      } catch (error) {
        console.warn(
          "No se pudo ampliar el timeline de partida:",
          String(error),
        );
      }
    }
  })().finally(() => enrichments.delete(id));
  enrichments.set(id, request);
  await request;
}

matchRoutes.get("/matches/:id", async (c) => {
  const id = c.req.param("id");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return c.json({ error: "Identificador de partida inválido" }, 400);
  }
  const [owned] = await db.select({
    participant: matchParticipants,
    match: matches,
    metrics: matchMetrics,
  })
    .from(matchParticipants).innerJoin(
      riotAccounts,
      eq(riotAccounts.id, matchParticipants.riotAccountId),
    )
    .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
    .leftJoin(
      matchMetrics,
      eq(matchMetrics.matchParticipantId, matchParticipants.id),
    )
    .where(and(eq(riotAccounts.userId, c.get("userId")), eq(matches.id, id)))
    .limit(1);
  if (!owned) {
    return c.json({ error: "No encontramos esa partida en tu historial" }, 404);
  }
  await enrich(
    id,
    owned.match.riotMatchId,
    !owned.match.rawDetail,
    !owned.match.rawTimeline,
  );
  const [cached] = await db.select().from(matches).where(eq(matches.id, id))
    .limit(1);
  if (!cached) {
    return c.json({ error: "Esta partida ya no está en tu historial" }, 404);
  }
  const detail = cached.rawDetail as RiotMatch | null;
  const timeline = cached.rawTimeline as RiotMatchTimeline | null;
  const own = detail?.info.participants.find((p) =>
    p.puuid === owned.participant.puuid
  );
  const participants = detail?.info.participants.map((p) => ({
    participantId: p.participantId,
    summonerName: p.riotIdGameName || p.championName,
    champion: p.championName,
    role: p.teamPosition,
    teamId: p.teamId,
    win: p.win,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    csTotal: p.totalMinionsKilled + p.neutralMinionsKilled,
    goldTotal: p.goldEarned,
    damageTotal: p.totalDamageDealtToChampions,
    visionScore: p.visionScore,
    isSelf: p.puuid === owned.participant.puuid,
    rawStats: Object.fromEntries(
      [
        "item0",
        "item1",
        "item2",
        "item3",
        "item4",
        "item5",
        "item6",
        "summoner1Id",
        "summoner2Id",
      ]
        .map((key) => [key, (p as unknown as Record<string, unknown>)[key]]),
    ),
  })) ?? [{ ...owned.participant, isSelf: true, summonerName: "Tu partida" }];
  const events = playerMapEvents(
    timeline,
    own?.participantId,
    detail?.info.participants,
  );
  // Raw Riot payloads stay in the cache; the response exposes only fields the UI uses.
  const metadata = {
    id: cached.id,
    riotMatchId: cached.riotMatchId,
    queueId: cached.queueId,
    patchVersion: cached.patchVersion,
    gameCreation: cached.gameCreation,
    gameDurationSeconds: cached.gameDurationSeconds,
  };
  return c.json({
    match: metadata,
    participant: owned.participant,
    metrics: owned.metrics,
    participants,
    events,
    mapId: detail?.info.mapId ?? null,
    detailAvailable: Boolean(detail),
    timelineAvailable: Boolean(timeline),
    warning: !detail || !timeline
      ? "Parte del detalle no está disponible. Podés reintentar cuando Riot vuelva a estar accesible."
      : null,
  });
});

const insightRequests = new Map<string, Promise<MapInsights>>();
// The provider quota is shared by all map requests using this server's API key.
let mapRateLimitUntil = 0;
matchRoutes.post("/matches/:id/insights", async (c) => {
  const focus = c.req.query("focus") ?? "all";
  if (!["all", "highlights", "mistake", "good"].includes(focus)) {
    return c.json({ error: "Filtro de análisis inválido" }, 400);
  }
  const id = c.req.param("id");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) return c.json({ error: "Identificador de partida inválido" }, 400);
  const [owned] = await db.select({
    participant: matchParticipants,
    match: matches,
    metrics: matchMetrics,
  }).from(matchParticipants)
    .innerJoin(
      riotAccounts,
      eq(riotAccounts.id, matchParticipants.riotAccountId),
    )
    .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
    .innerJoin(
      matchMetrics,
      eq(matchMetrics.matchParticipantId, matchParticipants.id),
    )
    .where(and(eq(riotAccounts.userId, c.get("userId")), eq(matches.id, id)))
    .limit(1);
  if (!owned) {
    return c.json({ error: "No encontramos esa partida en tu historial" }, 404);
  }
  const extra = owned.metrics.extra as { mapInsights?: MapInsights } | null;
  const detail = owned.match.rawDetail as RiotMatch | null;
  const timeline = owned.match.rawTimeline as RiotMatchTimeline | null;
  const own = detail?.info.participants.find((p) =>
    p.puuid === owned.participant.puuid
  );
  if (!own || !timeline || detail?.info.mapId !== 11) {
    return c.json({
      error:
        "El análisis necesita el detalle y timeline de una partida de la Grieta. Reintenta cargar el detalle.",
    }, 409);
  }
  const events = playerMapEvents(
    timeline,
    own.participantId,
    detail.info.participants,
  );
  const coaching = await compactCoachContext(c.get("userId"));
  const coachingRevision = JSON.stringify(coaching);
  const cached = extra?.mapInsights?.coachingRevision === coachingRevision && extra?.mapInsights?.version === MAP_INSIGHTS_VERSION &&
      Array.isArray(extra.mapInsights.observations)
    ? extra.mapInsights
    : null;
  const current = mergeMapInsights(cached, null, events.length);
  if (current.progress.complete) return c.json(current);
  const metricId = owned.metrics.id;
  const key = `${metricId}:${coachingRevision}`;
  if (Date.now() < mapRateLimitUntil) {
    const retryAfterSeconds = Math.ceil(
      (mapRateLimitUntil - Date.now()) / 1000,
    );
    c.header("Retry-After", String(retryAfterSeconds));
    return c.json({
      code: "rate_limit",
      error:
        "El coach alcanzó temporalmente el límite de uso. Puedes reintentar al terminar la espera.",
      retryAfterSeconds,
      partial: current,
    }, 429);
  }
  let request = insightRequests.get(key);
  if (!request) {
    request = (async () => {
      // Re-read after acquiring the shared request slot. A second tab may have
      // finished a batch after this HTTP request loaded its ownership row.
      const [row] = await db.select({ extra: matchMetrics.extra })
        .from(matchMetrics).where(eq(matchMetrics.id, metricId)).limit(1);
      if (!row) throw new Error("La partida ya no está disponible");
      const stored = row.extra as { mapInsights?: MapInsights } | null;
      const saved = stored?.mapInsights?.coachingRevision === coachingRevision && stored?.mapInsights?.version === MAP_INSIGHTS_VERSION &&
          Array.isArray(stored.mapInsights.observations)
        ? stored.mapInsights
        : null;
      const latest = mergeMapInsights(saved, null, events.length);
      if (latest.progress.complete) return latest;
      const reviewed = reviewedEventIndexes(latest);
      const pending = events.map((event, eventIndex) => ({
        ...event,
        eventIndex,
      }))
        .filter((event) => !reviewed.has(event.eventIndex));
      // A filter prioritizes candidates, never assumes that a kill is good or a
      // death is an error. Every remaining event is eventually classified too.
      const priority = (kind: string) =>
        focus === "mistake"
          ? (kind === "death" ? 0 : 1)
          : focus === "good"
          ? (kind === "death" ? 1 : 0)
          : 0;
      pending.sort((a, b) =>
        priority(a.kind) - priority(b.kind) || a.eventIndex - b.eventIndex
      );
      const eventIndexes: number[] = [];
      let contextCharacters = 0;
      for (const event of pending) {
        const size = JSON.stringify(event).length;
        // Rich moments use smaller batches; none are dropped to fit a request.
        if (eventIndexes.length && contextCharacters + size > 4000) break;
        eventIndexes.push(event.eventIndex);
        contextCharacters += size;
        if (eventIndexes.length === 4) break;
      }
      const batch = await explainMapMoments({
        coaching,
        teamId: owned.participant.teamId,
        durationSeconds: owned.match.gameDurationSeconds,
        queueId: owned.match.queueId,
        patchVersion: owned.match.patchVersion,
        composition: detail.info.participants.map((participant) => ({
          champion: participant.championName,
          role: participant.teamPosition,
          teamId: participant.teamId,
        })),
        champion: owned.participant.champion,
        role: owned.participant.role,
        win: owned.participant.win,
        kills: owned.participant.kills,
        deaths: owned.participant.deaths,
        assists: owned.participant.assists,
        metrics: {
          csPerMin: owned.metrics.csPerMin,
          kda: owned.metrics.kda,
          visionScorePerMin: owned.metrics.visionScorePerMin,
          killParticipation: owned.metrics.killParticipation,
          deathsBefore10: owned.metrics.deathsBefore10,
        },
        events,
      }, eventIndexes);
      const insights = { ...mergeMapInsights(latest, batch, events.length), coachingRevision };
      await db.update(matchMetrics).set({
        extra: sql`coalesce(${matchMetrics.extra}, '{}'::jsonb) || ${
          JSON.stringify({ mapInsights: insights })
        }::jsonb`,
      }).where(eq(matchMetrics.id, metricId));
      return insights;
    })().finally(() => insightRequests.delete(key));
    insightRequests.set(key, request);
  }
  try {
    return c.json(await request);
  } catch (error) {
    console.warn(
      "No se pudieron generar los consejos del mapa:",
      String(error),
    );
    const code = error instanceof LlmError ? error.code : "upstream";
    if (code === "rate_limit") {
      const retryAfterSeconds = error instanceof LlmError
        ? error.retryAfterSeconds ?? 60
        : 60;
      mapRateLimitUntil = Math.max(
        mapRateLimitUntil,
        Date.now() + retryAfterSeconds * 1000,
      );
      c.header("Retry-After", String(retryAfterSeconds));
      return c.json({
        code,
        error:
          "El coach alcanzó temporalmente el límite de uso. Puedes reintentar al terminar la espera.",
        retryAfterSeconds,
        partial: current,
      }, 429);
    }
    const messages = {
      configuration:
        "El coach no está disponible por un problema de configuración del servicio.",
      timeout:
        "El análisis está tardando demasiado. Puedes volver a intentarlo.",
      invalid_response:
        "El coach devolvió una respuesta incompleta o inválida. Puedes volver a intentarlo.",
      upstream:
        "No pudimos completar el análisis con el servicio del coach. Reintenta en un momento.",
    };
    return c.json({ code, error: messages[code], partial: current }, 502);
  }
});
