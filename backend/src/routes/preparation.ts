import { Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { verifySessionToken } from "../auth/jwt.ts";
import { championAbilities, preparationCatalog } from "../preparation/catalog.ts";
import { getAppSkillOrder } from "../preparation/skillOrder.ts";
import {
  buildPreparation,
  parseDraft,
  PreparationValidationError,
} from "../preparation/guide.ts";
import { readPlayerProfile } from "../player/profile.ts";
import { db } from "../db/client.ts";
import { liveDraftConnections, riotAccounts } from "../db/schema.ts";
import { eq } from "npm:drizzle-orm@^0.36.0";
import { getChampionStats } from "../riot/ingest.ts";
import { catalogRunesFromScrape, lolalyticsTeamRank, scrapeLolalyticsBuild } from "../preparation/lolalytics.ts";
export const preparationRoutes = new Hono<{ Variables: { userId: string } }>();
preparationRoutes.use("*", async (c, next) => {
  const token = getCookie(c, "session");
  const id = token ? await verifySessionToken(token) : null;
  if (!id) return c.json({ error: "No autenticado" }, 401);
  c.set("userId", id);
  await next();
});
preparationRoutes.get("/catalog", async (c) => {
  try {
    const data = await preparationCatalog();
    return c.json({ version: data.version, champions: data.champions });
  } catch {
    return c.json({
      error: "No pudimos cargar el catálogo de Riot. Reintenta en un momento.",
    }, 503);
  }
});
preparationRoutes.post("/guide", async (c) => {
  const body = await c.req.json().catch(() => null);
  let catalog;
  try {
    catalog = await preparationCatalog();
  } catch {
    return c.json({
      error:
        "El catálogo de Riot no está disponible. Tu selección se conserva; vuelve a intentarlo.",
    }, 503);
  }
  try {
    const liveDraftId = body && typeof body === "object" &&
        typeof (body as Record<string, unknown>).liveDraftId === "string" &&
        /^[a-zA-Z0-9-]{1,80}$/.test((body as Record<string, string>).liveDraftId)
      ? (body as Record<string, string>).liveDraftId
      : null;
    const input = parseDraft(body, catalog),
      profile = await readPlayerProfile(c.get("userId"));
    const [account] = await db.select({ id: riotAccounts.id, soloTier: riotAccounts.soloTier }).from(
      riotAccounts,
    ).where(eq(riotAccounts.userId, c.get("userId"))).limit(1);
    let teammateTiers: string[] = [];
    let activeLiveSnapshot: Record<string, unknown> | null = null;
    if (liveDraftId) {
      const [connection] = await db.select({
        snapshot: liveDraftConnections.snapshot,
        receivedAt: liveDraftConnections.receivedAt,
        expiresAt: liveDraftConnections.expiresAt,
      }).from(liveDraftConnections).where(
        eq(liveDraftConnections.userId, c.get("userId")),
      ).limit(1);
      const snapshot = connection?.snapshot && typeof connection.snapshot === "object"
        ? connection.snapshot as Record<string, unknown>
        : null;
      const fresh = connection?.receivedAt && connection.expiresAt > new Date() &&
        Date.now() - connection.receivedAt.getTime() <= 20000;
      if (
        fresh && snapshot?.phase === "ChampSelect" &&
        snapshot.draftId === liveDraftId && snapshot.accountStatus === "match"
      ) {
        activeLiveSnapshot = snapshot;
        if (Array.isArray(snapshot.teammateTiers)) {
          teammateTiers = snapshot.teammateTiers.filter(
            (tier): tier is string => typeof tier === "string",
          );
        }
      }
    }
    const observed = account ? await getChampionStats(account.id) : [];
    const guide = buildPreparation(
      input,
      catalog,
      profile?.champions ?? [],
      profile?.experience ?? null,
      observed,
    );
    const rank = lolalyticsTeamRank(account?.soloTier, teammateTiers);
    const theirTeam = Array.isArray(activeLiveSnapshot?.theirTeam)
      ? activeLiveSnapshot.theirTeam as Record<string, unknown>[]
      : [];
    const sameLaneOpponents = theirTeam.filter((slot) =>
      slot.lockedIn === true && slot.role === input.role &&
      Number.isSafeInteger(slot.championId) && Number(slot.championId) > 0
    );
    // Only use matchup data when the LCU explicitly assigns exactly one
    // confirmed enemy to our lane. Ambiguous or missing positions use the
    // normal champion + lane build.
    const matchupOpponent = sameLaneOpponents.length === 1
      ? catalog.champions.find((champion) =>
        Number(champion.key) === Number(sameLaneOpponents[0].championId)
      )?.id ?? null
      : null;
    const matchupBuild = matchupOpponent
      ? await scrapeLolalyticsBuild(guide.chosen.id, input.role, rank.filter, matchupOpponent)
      : null;
    const scrapedBuild = matchupBuild ?? await scrapeLolalyticsBuild(guide.chosen.id, input.role, rank.filter);
    const sourcedRunes = scrapedBuild
      ? catalogRunesFromScrape(catalog, scrapedBuild)
      : null;
    const analytics = scrapedBuild && sourcedRunes ? scrapedBuild : null;
    const runes = sourcedRunes ?? {
        primaryTree: null,
        primary: [],
        primarySlots: [],
        secondaryTree: null,
        secondary: [],
        secondarySlots: [],
        statMods: [],
        statModOptions: [],
        statModSelection: [],
        source: null,
        sourceUrl: null,
        patch: null,
        sampleGames: null,
        winRate: null,
        reason: "No pudimos validar una página de runas actual para este campeón y línea. No mostraremos una plantilla estimada; vuelve a intentarlo más tarde.",
      };
    const matchupNote = liveDraftId && activeLiveSnapshot
      ? matchupOpponent
        ? matchupBuild
          ? null
          : `No pudimos validar la página de enfrentamiento contra ${matchupOpponent}; se muestra la build general de ${guide.chosen.name}.`
        : `No se detectó un rival confirmado con línea ${input.role}; se muestra la build general de ${guide.chosen.name}.`
      : null;
    const warnings = analytics
      ? guide.warnings
      : [...guide.warnings, "Los datos de LoLalytics no están disponibles para este campeón y línea; no se sustituirá la build por plantillas."];
    if (matchupNote) warnings.push(matchupNote);
    const [skills, skillOrder] = await Promise.all([
      championAbilities(catalog.version, guide.chosen.id).catch(() => []),
      getAppSkillOrder(
        guide.chosen.id,
        input.role,
        catalog.version,
      ).catch(() => null),
    ]);
    return c.json({ ...guide, rankFilter: rank.filter, rankLabel: rank.label, rankBoosted: rank.boostedByTeam, runes, analytics, warnings, skills, skillOrder });
  } catch (error) {
    if (error instanceof PreparationValidationError) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});
