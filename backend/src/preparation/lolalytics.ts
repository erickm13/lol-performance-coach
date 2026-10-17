import type { PreparationCatalog, RuneTree, CatalogRune } from "./catalog.ts";

const BASE = "https://lolalytics.com/lol";
const CACHE_MS = 30 * 60 * 1000;
const ROLE_LANE: Record<string, string> = {
  TOP: "top",
  JUNGLE: "jungle",
  MIDDLE: "middle",
  BOTTOM: "bottom",
  UTILITY: "support",
};
const LOLALYTICS_RANKS: Record<string, { filter: string; label: string }> = {
  IRON: { filter: "iron", label: "Hierro" },
  BRONZE: { filter: "bronze", label: "Bronce" },
  SILVER: { filter: "silver", label: "Plata" },
  GOLD: { filter: "gold", label: "Oro" },
  PLATINUM: { filter: "platinum", label: "Platino" },
  EMERALD: { filter: "emerald", label: "Esmeralda" },
  DIAMOND: { filter: "diamond", label: "Diamante" },
  MASTER: { filter: "master", label: "Maestro" },
  GRANDMASTER: { filter: "grandmaster", label: "Gran Maestro" },
  CHALLENGER: { filter: "challenger", label: "Retador" },
};
const RANK_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
export function lolalyticsRankFilter(tier: string | null | undefined) {
  const rank = tier ? LOLALYTICS_RANKS[tier.toUpperCase()] : null;
  return rank ?? { filter: "all", label: "Todas las ligas" };
}
export function lolalyticsTeamRank(accountTier: string | null | undefined, teammateTiers: string[]) {
  const accountRank = accountTier ? accountTier.toUpperCase() : null;
  const candidates = [accountRank, ...teammateTiers.map((tier) => tier.toUpperCase())]
    .filter((tier): tier is string => !!tier && !!LOLALYTICS_RANKS[tier]);
  const selected = candidates.reduce<string | null>((best, tier) =>
    !best || RANK_ORDER.indexOf(tier) > RANK_ORDER.indexOf(best) ? tier : best, null);
  const rank = lolalyticsRankFilter(selected);
  return { ...rank, boostedByTeam: !!selected && selected !== accountRank };
}
const STAT_MODS: Record<number, { name: string; description: string }> = {
  5001: { name: "Vida", description: "+65 de vida" },
  5002: { name: "Armadura", description: "+6 de armadura" },
  5003: { name: "Resistencia mágica", description: "+8 de resistencia mágica" },
  5005: { name: "Velocidad de ataque", description: "+10% de velocidad de ataque" },
  5007: { name: "Aceleración de habilidad", description: "+8 de aceleración de habilidad" },
  5008: { name: "Fuerza adaptable", description: "+9 de fuerza adaptable" },
  5010: { name: "Velocidad de movimiento", description: "+2% de velocidad de movimiento" },
  5011: { name: "Vida progresiva", description: "+10–180 de vida según el nivel" },
  5013: { name: "Tenacidad y resistencia a ralentizaciones", description: "+10% de tenacidad y resistencia a ralentizaciones" },
};

export type ScrapedLolalyticsBuild = {
  champion: string;
  role: string;
  matchup: { opponent: string; role: string } | null;
  patch: string | null;
  primary: number[];
  secondary: number[];
  statMods: number[];
  statModOptions: number[];
  statModSelection: boolean[];
  sampleGames: number | null;
  winRate: number | null;
  url: string;
  summary: {
    winRate: number | null;
    winRateDelta: number | null;
    gameAverageWinRate: number | null;
    pickRate: number | null;
    banRate: number | null;
    games: number | null;
    rank: number | null;
    totalChampions: number | null;
    tier: string | null;
  };
  skillPriority: { sequence: string[]; winRate: number | null; games: number | null };
  skillOrder: { sequence: (string | null)[]; winRate: number | null; games: number | null };
  summonerSpells: { id: string; name: string; winRate: number | null; games: number | null }[];
  startingItems: ScrapedItem[];
  coreItems: ScrapedItem[];
  coreBuild: { winRate: number | null; games: number | null };
  situationalItems: { slot: number; options: ScrapedItem[] }[];
};
export type ScrapedItem = { id: string; name: string; winRate: number | null; games: number | null };

const cache = new Map<string, { at: number; value: ScrapedLolalyticsBuild }>();
const pending = new Map<string, Promise<ScrapedLolalyticsBuild | null>>();
const retryAfter = new Map<string, number>();

function selectedRuneIds(section: string, prefix: "rune" | "statmod"): number[] {
  const ids: number[] = [];
  const imagePattern = /<img\b[^>]*>/gi;
  for (const match of section.matchAll(imagePattern)) {
    const tag = match[0];
    const source = tag.match(/\bsrc=["']https:\/\/cdn5\.lolalytics\.com\/(?:rune\d+|statmod\d+)\/(\d+)\.webp["']/i);
    if (!source || !tag.includes(`/${prefix}`)) continue;
    const classes = tag.match(/\bclass=["']([^"']*)["']/i)?.[1] ?? "";
    if (/\bgrayscale\b/.test(classes)) continue;
    const id = Number(source[1]);
    if (Number.isSafeInteger(id) && (prefix === "statmod" || !ids.includes(id))) {
      ids.push(id);
    }
  }
  return ids;
}

function statModChoices(section: string): { ids: number[]; selected: boolean[] } {
  const ids: number[] = [];
  const selected: boolean[] = [];
  for (const match of section.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const source = tag.match(/\bsrc=["']https:\/\/cdn5\.lolalytics\.com\/statmod\d+\/(\d+)\.webp["']/i);
    if (!source) continue;
    const id = Number(source[1]);
    if (!Number.isSafeInteger(id)) continue;
    ids.push(id);
    const classes = tag.match(/\bclass=["']([^"']*)["']/i)?.[1] ?? "";
    selected.push(!/\bgrayscale\b/.test(classes));
  }
  return { ids, selected };
}

function pageText(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

function sectionBetween(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  if (from < 0) return "";
  const to = html.indexOf(end, from + start.length);
  return html.slice(from, to < 0 ? html.length : to);
}

function metric(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = text.match(new RegExp(`([\\d.]+)\\s*%\\s*${escaped}\\b`, "i"));
  return found ? Number(found[1]) : null;
}

function gamesCount(text: string): number | null {
  const found = text.match(/([\d,]+)\s*Games\b/i);
  return found ? Number(found[1].replaceAll(",", "")) : null;
}

function imageEntries(section: string, kind: "item64" | "spell64" | "skill68") {
  const entries: { id: string; name: string; key?: string; index: number }[] = [];
  const tags = /<img\b[^>]*>/gi;
  for (const match of section.matchAll(tags)) {
    const tag = match[0];
    const src = tag.match(new RegExp(`src=[\"']https://cdn5\\.lolalytics\\.com/${kind}/([^\\s\"']+)`, "i"))?.[1];
    if (!src) continue;
    const name = tag.match(/\balt=["']([^"']*)["']/i)?.[1];
    if (!name) continue;
    const id = kind === "skill68" ? src.match(/_([qwer])\.webp/i)?.[1]?.toUpperCase() : src.match(/^(\d+)\.webp/i)?.[1];
    if (!id) continue;
    entries.push({ id, name: pageText(name), ...(kind === "skill68" ? { key: id } : {}), index: match.index ?? 0 });
  }
  return entries;
}

function sectionPerformance(section: string) {
  const text = pageText(section);
  const labeledRate = metric(text, "Win Rate");
  const inline = text.match(/([\d.]+)\s*%\s*(?:Win Rate\s*)?([\d,]+)(?:\s*Games)?/i);
  return {
    winRate: labeledRate ?? (inline ? Number(inline[1]) : null),
    games: gamesCount(text) ?? (inline ? Number(inline[2].replaceAll(",", "")) : null),
  };
}

function itemCards(section: string): ScrapedItem[] {
  const entries = imageEntries(section, "item64");
  return entries.map((entry, index) => {
    const end = entries[index + 1]?.index ?? section.length;
    const performance = sectionPerformance(section.slice(entry.index, end));
    return { id: entry.id, name: entry.name, ...performance };
  });
}

function skillOrderSequence(section: string): (string | null)[] {
  const sequence: (string | null)[] = Array(15).fill(null);
  const rows = [...section.matchAll(/<div class="m-auto mb-\[2px\] flex w-\[317px\]" q:key="\d+">([\s\S]*?)(?=<div class="m-auto mb-\[2px\] flex w-\[317px\]" q:key="|$)/g)];
  for (const row of rows) {
    const key = row[1].match(/\/skill68\/[^\"']+_([qwer])\.webp/i)?.[1]?.toUpperCase();
    if (!key) continue;
    const cells = /class="mr-\[1px\] h-\[28px\] w-\[18px\] border border-\[#30687a\]" q:key="(\d+)"><div[^>]*>(\d+)<\/div><\/div>/g;
    for (const cell of row[1].matchAll(cells)) {
      const level = Number(cell[1]) + 1;
      if (level >= 1 && level <= sequence.length) sequence[level - 1] = key;
    }
  }
  return sequence;
}

export function parseLolalyticsBuildPage(html: string, champion: string, role: string, url: string, opponent: string | null = null): ScrapedLolalyticsBuild | null {
  const primaryStart = html.indexOf(">Primary Runes<");
  const secondaryStart = html.indexOf(">Secondary<", primaryStart + 1);
  const statsStart = html.indexOf(">Stat Mods<", secondaryStart + 1);
  if (primaryStart < 0 || secondaryStart < 0 || statsStart < 0) return null;
  const primaryIds = selectedRuneIds(html.slice(primaryStart, secondaryStart), "rune");
  const secondaryIds = selectedRuneIds(html.slice(secondaryStart, statsStart), "rune");
  const statsEnd = html.indexOf(">Starting Items<", statsStart);
  const statChoices = statModChoices(html.slice(statsStart, statsEnd > statsStart ? statsEnd : statsStart + 6000));
  const statsIds = statChoices.ids.filter((_, index) => statChoices.selected[index]);
  if (primaryIds.length !== 4 || secondaryIds.length !== 2 || statChoices.ids.length !== 9 || statsIds.length !== 3) return null;

  const text = pageText(html);
  const patch = text.match(/\bPatch\s+(\d+\.\d+)\b/i)?.[1] ?? null;
  const runeStatsText = pageText(html.slice(primaryStart, statsStart));
  const performance = runeStatsText.match(/([\d.]+)\s*%\s*Win Rate[\s\S]{0,100}?([\d,]+)\s*Games/i);
  const winRate = performance ? Number(performance[1]) : null;
  const sampleGames = performance ? Number(performance[2].replaceAll(",", "")) : null;
  const laneNames: Record<string, string> = { top: "top", jungle: "jungle", middle: "middle", bottom: "bottom", support: "support" };
  const lane = laneNames[ROLE_LANE[role]];
  const matchupHeading = opponent
    ? new RegExp(`${lane}\\s+vs\\s+.+?\\s+${lane}\\s+Build\\s*&\\s*Runes`, "i").test(text) && /wins against/i.test(text)
    : false;
  const heading = text.match(/Build, Runes & Counters for (top|jungle|middle|bottom|support)\b/i);
  if (opponent ? !matchupHeading : (!heading || heading[1].toLowerCase() !== lane)) return null;
  const metricStart = html.lastIndexOf('<div class="flex justify-around border', html.indexOf(">Win Rate</div>"));
  const metricEnd = html.indexOf(">Skill Priority", metricStart);
  const summaryHtml = html.slice(metricStart < 0 ? 0 : metricStart, metricEnd < 0 ? undefined : metricEnd);
  const summaryText = pageText(summaryHtml);
  const introText = pageText(html.slice(0, Math.max(0, metricStart)));
  const ranking = introText.match(/rank\s+(\d+)\s+of\s+(\d+)\s+and graded\s+([A-Z][+-]?)\s+Tier/i);

  const priorityHtml = sectionBetween(html, ">Skill Priority", ">Skill Order");
  const orderHtml = sectionBetween(html, ">Skill Order", ">Primary Runes");
  const spellsHtml = sectionBetween(html, ">Summoner Spells", ">Skill Order");
  const startingHtml = sectionBetween(html, ">Starting Items", ">Core Build");
  const coreHtml = sectionBetween(html, ">Core Build", ">Item 4");
  const corePerformance = sectionPerformance(coreHtml);
  const priorityStats = sectionPerformance(priorityHtml);
  const orderStats = sectionPerformance(orderHtml);
  const spellStats = sectionPerformance(spellsHtml);
  const priority = imageEntries(priorityHtml, "skill68");
  const spells = imageEntries(spellsHtml, "spell64");
  const skillOrder = skillOrderSequence(orderHtml);
  const slotItems = [4, 5, 6].map((slot) => ({
    slot,
    options: itemCards(sectionBetween(html, `>Item ${slot}`, slot === 6 ? ">Overall" : `>Item ${slot + 1}`)),
  }));
  const matchupText = opponent
    ? text.match(/wins against\s+.+?\s+([\d.]+)%\s+of the time[\s\S]{0,240}/i)?.[0] ?? ""
    : "";
  const matchupWinRate = opponent
    ? Number(matchupText.match(/wins against\s+.+?\s+([\d.]+)%\s+of the time/i)?.[1] ?? NaN)
    : null;
  const matchupGames = opponent
    ? Number(matchupText.match(/([\d,]+)\s*Games\b/i)?.[1]?.replaceAll(",", "") ?? NaN)
    : null;
  const summary = {
    winRate: typeof matchupWinRate === "number" && Number.isFinite(matchupWinRate) ? matchupWinRate : metric(summaryText, "Win Rate"),
    winRateDelta: metric(summaryText, "WR Delta"),
    gameAverageWinRate: metric(summaryText, "Game Avg WR"),
    pickRate: metric(summaryText, "Pick Rate"),
    banRate: metric(summaryText, "Ban Rate"),
    games: typeof matchupGames === "number" && Number.isFinite(matchupGames) ? matchupGames : gamesCount(summaryText),
    rank: ranking ? Number(ranking[1]) : null,
    totalChampions: ranking ? Number(ranking[2]) : null,
    tier: ranking?.[3] ?? null,
  };
  const requiredSections = priority.length >= 3 && orderHtml.length > 0 && spells.length >= 2 &&
    imageEntries(startingHtml, "item64").length > 0 && imageEntries(coreHtml, "item64").length >= 3;
  if (!requiredSections) return null;

  return {
    champion,
    role,
    matchup: opponent ? { opponent, role } : null,
    patch,
    primary: primaryIds,
    secondary: secondaryIds,
    statMods: statsIds,
    statModOptions: statChoices.ids,
    statModSelection: statChoices.selected,
    sampleGames,
    winRate,
    url,
    summary,
    skillPriority: { sequence: priority.slice(0, 3).map((entry) => entry.key ?? ""), ...priorityStats },
    skillOrder: { sequence: skillOrder, ...orderStats },
    summonerSpells: spells.slice(0, 2).map((spell) => ({ id: spell.id, name: spell.name, ...spellStats })),
    startingItems: itemCards(startingHtml),
    coreItems: itemCards(coreHtml),
    coreBuild: corePerformance,
    situationalItems: slotItems,
  };
}

export function scrapeLolalyticsBuild(champion: string, role: string, rankFilter = "all", opponent: string | null = null): Promise<ScrapedLolalyticsBuild | null> {
  const lane = ROLE_LANE[role];
  const allowedRanks = new Set(["all", ...Object.values(LOLALYTICS_RANKS).map((rank) => rank.filter)]);
  if (!lane || !/^[A-Za-z][A-Za-z0-9]{1,30}$/.test(champion) || (opponent !== null && !/^[A-Za-z][A-Za-z0-9]{1,30}$/.test(opponent)) || !allowedRanks.has(rankFilter)) return Promise.resolve(null);
  const key = `${champion.toLowerCase()}:${lane}:${opponent?.toLowerCase() ?? "general"}:${rankFilter}`;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < CACHE_MS) return Promise.resolve(saved.value);
  if ((retryAfter.get(key) ?? 0) > Date.now()) return Promise.resolve(null);
  const existing = pending.get(key);
  if (existing) return existing;

  const url = opponent
    ? `${BASE}/${champion.toLowerCase()}/vs/${opponent.toLowerCase()}/build/?${new URLSearchParams({ lane, vslane: lane, tier: rankFilter, region: "lan" })}`
    : `${BASE}/${champion.toLowerCase()}/build/?${new URLSearchParams({ lane, tier: rankFilter, region: "lan" })}`;
  const request = (async () => {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "LoLPerformanceCoach/1.0 (build guide)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return null;
      const html = await response.text();
      const value = parseLolalyticsBuildPage(html, champion, role, url, opponent);
      if (value) {
        cache.set(key, { at: Date.now(), value });
        retryAfter.delete(key);
      } else {
        retryAfter.set(key, Date.now() + 2 * 60 * 1000);
      }
      return value;
    } catch {
      retryAfter.set(key, Date.now() + 2 * 60 * 1000);
      return null;
    }
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

function locateRune(trees: RuneTree[], id: number): { tree: RuneTree; rune: CatalogRune } | null {
  for (const tree of trees) {
    for (const slot of tree.slots) {
      const rune = slot.runes.find((candidate) => candidate.id === id);
      if (rune) return { tree, rune };
    }
  }
  return null;
}

export function catalogRunesFromScrape(catalog: PreparationCatalog, scraped: ScrapedLolalyticsBuild) {
  const mappedPrimary = scraped.primary.map((id) => locateRune(catalog.runes, id));
  const mappedSecondary = scraped.secondary.map((id) => locateRune(catalog.runes, id));
  if (mappedPrimary.some((entry) => !entry) || mappedSecondary.some((entry) => !entry)) return null;
  const primaryTree = mappedPrimary[0]!.tree;
  const secondaryTree = mappedSecondary[0]!.tree;
  if (mappedPrimary.some((entry) => entry!.tree.id !== primaryTree.id) || mappedSecondary.some((entry) => entry!.tree.id !== secondaryTree.id) || primaryTree.id === secondaryTree.id) return null;
  const statMods = scraped.statMods.map((id) => {
    const meta = STAT_MODS[id];
    if (!meta) return null;
    return { id, name: meta.name, icon: "", shortDesc: meta.description, longDesc: meta.description, sourceIcon: `https://cdn5.lolalytics.com/statmod32/${id}.webp` };
  });
  const statModOptions = scraped.statModOptions.map((id) => {
    const meta = STAT_MODS[id];
    if (!meta) return null;
    return { id, name: meta.name, icon: "", shortDesc: meta.description, longDesc: meta.description, sourceIcon: `https://cdn5.lolalytics.com/statmod32/${id}.webp` };
  });
  if (statMods.some((entry) => !entry) || statModOptions.some((entry) => !entry)) return null;
  return {
    primaryTree: { name: primaryTree.name, icon: primaryTree.icon },
    primary: mappedPrimary.map((entry) => entry!.rune),
    secondaryTree: { name: secondaryTree.name, icon: secondaryTree.icon },
    secondary: mappedSecondary.map((entry) => entry!.rune),
    primarySlots: primaryTree.slots.map((slot) => slot.runes),
    secondarySlots: secondaryTree.slots.slice(1).map((slot) => slot.runes),
    statMods,
    statModOptions,
    statModSelection: scraped.statModSelection,
    source: "lolalytics" as const,
    sourceUrl: scraped.url,
    patch: scraped.patch,
    sampleGames: scraped.sampleGames,
    winRate: scraped.winRate,
    reason: `Página de runas observada para ${scraped.champion} en ${scraped.role}; parche ${scraped.patch ?? "no identificado"}. La tasa y la muestra corresponden a la clave principal, no garantizan el resultado de la partida. Adapta las elecciones al enfrentamiento y confírmalas en el cliente.`,
  };
}
