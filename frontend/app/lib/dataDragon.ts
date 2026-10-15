export const DEFAULT_DDRAGON_VERSION = "16.20.1";

export type ItemDetails = {
  name: string;
  description: string;
  plaintext?: string;
  gold?: { total: number; sell: number; purchasable: boolean };
};

export type ItemCatalog = Record<string, ItemDetails>;

export type SummonerSpellDetails = {
  key: string;
  name: string;
  description: string;
  cooldownBurn?: string;
  image: { full: string };
};

export type SummonerSpellCatalog = Record<string, SummonerSpellDetails>;

export type ChampionAbility = {
  name: string;
  description: string;
  image: { full: string };
};

export type ChampionDetails = {
  id: string;
  name: string;
  title: string;
  tags: string[];
  passive: ChampionAbility;
  spells: ChampionAbility[];
};

const catalogRequests = new Map<string, Promise<ItemCatalog>>();
const spellCatalogRequests = new Map<string, Promise<SummonerSpellCatalog>>();
const championRequests = new Map<string, Promise<ChampionDetails>>();

export function loadItemCatalog(version: string): Promise<ItemCatalog> {
  const cached = catalogRequests.get(version);
  if (cached) return cached;
  const request = fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/es_MX/item.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error("No se pudo cargar el catálogo de objetos");
      const catalog = await response.json();
      if (!catalog.data || typeof catalog.data !== "object") throw new Error("Catálogo de objetos inválido");
      return catalog.data as ItemCatalog;
    })
    .catch((error) => {
      catalogRequests.delete(version);
      throw error;
    });
  catalogRequests.set(version, request);
  return request;
}

export function loadSummonerSpellCatalog(version: string): Promise<SummonerSpellCatalog> {
  const cached = spellCatalogRequests.get(version);
  if (cached) return cached;
  const request = fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/es_MX/summoner.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error("No se pudo cargar el catálogo de hechizos");
      const catalog = await response.json();
      if (!catalog.data || typeof catalog.data !== "object") throw new Error("Catálogo de hechizos inválido");
      // Match-V5 uses numeric keys (4, 14...), while Data Dragon indexes by names.
      return Object.fromEntries(
        Object.values(catalog.data as Record<string, SummonerSpellDetails>)
          .filter((spell) => /^\d+$/.test(spell.key))
          .map((spell) => [spell.key, spell]),
      );
    })
    .catch((error) => {
      spellCatalogRequests.delete(version);
      throw error;
    });
  spellCatalogRequests.set(version, request);
  return request;
}

export function loadChampionDetails(champion: string, version: string): Promise<ChampionDetails> {
  const key = `${version}/${champion}`;
  const cached = championRequests.get(key);
  if (cached) return cached;
  const request = fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/es_MX/champion/${encodeURIComponent(champion)}.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error("No se pudieron cargar los datos del campeón");
      const catalog = await response.json();
      const details = catalog.data?.[champion] as ChampionDetails | undefined;
      if (!details?.name || !details.passive || !Array.isArray(details.spells)) {
        throw new Error("Datos de campeón inválidos");
      }
      return details;
    })
    .catch((error) => {
      championRequests.delete(key);
      throw error;
    });
  championRequests.set(key, request);
  return request;
}

// Extract text only: never insert Riot's HTML into the page.
export function dataDragonDescriptionText(description: string): string {
  const withLines = description
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:stats|mainText|p|div)>/gi, "\n");
  const document = new DOMParser().parseFromString(withLines, "text/html");
  document.querySelectorAll("script, style").forEach((node) => node.remove());
  return (document.body.textContent ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ChampionSummary = { key?: string; id: string; name: string; title: string; tags: string[]; info: { attack: number; magic: number; defense: number } };
const championCatalogRequests = new Map<string, Promise<ChampionSummary[]>>();
export function loadChampionCatalog(version: string): Promise<ChampionSummary[]> {
  const cached = championCatalogRequests.get(version);
  if (cached) return cached;
  const request = fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/es_MX/champion.json`).then(async (response) => {
    if (!response.ok) throw new Error("No se pudo cargar el catálogo de campeones.");
    const body = await response.json();
    if (!body.data || typeof body.data !== "object") throw new Error("Catálogo de campeones inválido.");
    return (Object.values(body.data) as ChampionSummary[]).filter((item) => item.id && item.name).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }).catch((error) => { championCatalogRequests.delete(version); throw error; });
  championCatalogRequests.set(version, request);
  return request;
}
