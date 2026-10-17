export type CatalogChampion = {
  key?: string;
  id: string;
  name: string;
  title: string;
  tags: string[];
  info: { attack: number; magic: number; defense: number };
};
export type CatalogItem = {
  name: string;
  description: string;
  plaintext?: string;
  tags?: string[];
  maps?: Record<string, boolean>;
  gold: { total: number; purchasable: boolean };
  inStore?: boolean;
  hideFromAll?: boolean;
  requiredChampion?: string;
  requiredAlly?: string;
  from?: string[];
  into?: string[];
};
export type CatalogRune = {
  id: number;
  name: string;
  icon: string;
  shortDesc: string;
  longDesc: string;
};
export type RuneTree = {
  id: number;
  key: string;
  name: string;
  icon: string;
  slots: { runes: CatalogRune[] }[];
};
export type CatalogSpell = {
  key: string;
  name: string;
  description: string;
  image: { full: string };
  modes: string[];
};
export type PreparationCatalog = {
  version: string;
  champions: CatalogChampion[];
  items: Record<string, CatalogItem>;
  runes: RuneTree[];
  spells: CatalogSpell[];
};
export type ChampionAbility = {
  key: "Q" | "W" | "E" | "R";
  name: string;
  description: string;
  image: { full: string };
};
const BASE = "https://ddragon.leagueoflegends.com";
let cached: { at: number; data: PreparationCatalog } | null = null;
let pending: Promise<PreparationCatalog> | null = null;
const abilityCache = new Map<string, Promise<ChampionAbility[]>>();
async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("No se pudo obtener el catálogo de Riot.");
  return response.json();
}
export function preparationCatalog(): Promise<PreparationCatalog> {
  if (cached && Date.now() - cached.at < 3600000) {
    return Promise.resolve(cached.data);
  }
  if (pending) return pending;
  pending = (async () => {
    const versions = await json<string[]>(`${BASE}/api/versions.json`);
    const version = versions[0];
    if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
      throw new Error("Versión de Data Dragon inválida.");
    }
    const prefix = `${BASE}/cdn/${version}/data/es_MX`;
    const [champions, items, runes, spells] = await Promise.all([
      json<{ data: Record<string, CatalogChampion> }>(
        `${prefix}/champion.json`,
      ),
      json<{ data: Record<string, CatalogItem> }>(`${prefix}/item.json`),
      json<RuneTree[]>(`${prefix}/runesReforged.json`),
      json<{ data: Record<string, CatalogSpell> }>(`${prefix}/summoner.json`),
    ]);
    if (
      !champions.data || !items.data || !Array.isArray(runes) || !spells.data
    ) throw new Error("Catálogo de Riot incompleto.");
    const data = {
      version,
      champions: Object.values(champions.data).map((
        { id, key, name, title, tags, info },
      ) => ({ id, key, name, title, tags, info })).sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      ),
      items: items.data,
      runes,
      spells: Object.values(spells.data).filter((spell) =>
        spell.modes.includes("CLASSIC")
      ),
    };
    cached = { at: Date.now(), data };
    return data;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
export function championAbilities(
  version: string,
  championId: string,
): Promise<ChampionAbility[]> {
  const cacheKey = `${version}:${championId}`;
  const previous = abilityCache.get(cacheKey);
  if (previous) return previous;

  const request = json<{
    data: Record<string, { spells: Omit<ChampionAbility, "key">[] }>;
  }>(`${BASE}/cdn/${version}/data/es_MX/champion/${championId}.json`)
    .then((response) => {
      const champion = Object.values(response.data ?? {})[0];
      if (!champion || !Array.isArray(champion.spells)) {
        throw new Error("Las habilidades no están disponibles en Data Dragon.");
      }
      const keys = ["Q", "W", "E", "R"] as const;
      return champion.spells.slice(0, 4).map((spell, index) => ({
        key: keys[index],
        name: spell.name,
        description: spell.description,
        image: spell.image,
      }));
    })
    .catch((error) => {
      abilityCache.delete(cacheKey);
      throw error;
    });
  abilityCache.set(cacheKey, request);
  return request;
}
export function purchasableItem(item: CatalogItem) {
  return item.maps?.["11"] === true && item.gold?.purchasable === true &&
    item.inStore !== false && !item.hideFromAll && !item.requiredChampion &&
    !item.requiredAlly;
}
