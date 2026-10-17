import { ROLE_LABELS, ROLES } from "../player/profile.ts";
import {
  type CatalogChampion,
  type PreparationCatalog,
  purchasableItem,
} from "./catalog.ts";
export class PreparationValidationError extends Error {}
export type DraftInput = {
  role: string;
  champion: string | null;
  allies: string[];
  enemies: string[];
  bans?: string[];
  availableChampions?: string[];
};
export function parseDraft(
  body: unknown,
  catalog: PreparationCatalog,
): DraftInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PreparationValidationError(
      "Revisa los campeones de tu preparación.",
    );
  }
  const input = body as Record<string, unknown>;
  if (
    typeof input.role !== "string" ||
    !(ROLES as readonly string[]).includes(input.role)
  ) {
    throw new PreparationValidationError(
      "Elige tu línea para preparar la partida.",
    );
  }
  const valid = (id: unknown): id is string =>
    typeof id === "string" &&
    catalog.champions.some((champion) => champion.id === id);
  const champion = input.champion === null || input.champion === undefined ||
      input.champion === ""
    ? null
    : input.champion;
  if (champion !== null && !valid(champion)) {
    throw new PreparationValidationError(
      "El campeón elegido no existe en el catálogo disponible.",
    );
  }
  const list = (key: string, max: number) => {
    const value = input[key] ?? [];
    if (
      !Array.isArray(value) || value.length > max ||
      value.some((id) => !valid(id)) || new Set(value).size !== value.length
    ) {
      throw new PreparationValidationError(
        `Revisa la selección de ${
          {
            allies: "aliados",
            enemies: "rivales",
            bans: "bloqueos",
            availableChampions: "campeones disponibles",
          }[key] ?? "campeones"
        }.`,
      );
    }
    return value as string[];
  };
  const allies = list("allies", 4), enemies = list("enemies", 5);
  const bans = list("bans", 20);
  if (champion && bans.includes(champion as string)) {
    throw new PreparationValidationError(
      "Tu campeón fue bloqueado. Espera a cambiar la elección en el cliente.",
    );
  }
  const selected = [...allies, ...enemies, ...(champion ? [champion] : [])];
  if (new Set(selected).size !== selected.length) {
    throw new PreparationValidationError(
      "Un campeón no puede ocupar dos posiciones de esta selección.",
    );
  }
  return {
    role: input.role,
    champion: champion as string | null,
    allies,
    enemies,
    ...(bans.length ? { bans } : {}),
    ...(input.availableChampions !== undefined
      ? { availableChampions: list("availableChampions", 1000) }
      : {}),
  };
}
// Reviewed role pool, not live pick-rate data. Unknown/new champions need a manual choice.
const ROLE_POOL: Record<string, string[]> = {
  TOP: [
    "Garen",
    "Malphite",
    "Mordekaiser",
    "Darius",
    "Gwen",
    "Shen",
    "Ornn",
    "Camille",
    "Fiora",
    "Jax",
    "Sett",
    "Aatrox",
    "Renekton",
    "Illaoi",
    "Teemo",
    "Kayle",
    "Nasus",
    "Chogath",
  ],
  JUNGLE: [
    "Warwick",
    "Amumu",
    "XinZhao",
    "JarvanIV",
    "Vi",
    "Nocturne",
    "Sejuani",
    "Shyvana",
    "Lillia",
    "Diana",
    "Kayn",
    "Viego",
    "Fiddlesticks",
    "Nunu",
    "Zac",
    "MasterYi",
    "LeeSin",
    "Elise",
    "Khazix",
    "Rengar",
    "Kindred",
    "Graves",
    "Nidalee",
    "Ekko",
    "Briar",
  ],
  MIDDLE: [
    "Annie",
    "Ahri",
    "Lux",
    "Vex",
    "Orianna",
    "Syndra",
    "Viktor",
    "Veigar",
    "Malzahar",
    "Zed",
    "Talon",
    "Akali",
    "Yasuo",
    "Yone",
    "Katarina",
    "Fizz",
    "Ekko",
    "AurelionSol",
    "Azir",
  ],
  BOTTOM: [
    "Ashe",
    "MissFortune",
    "Jinx",
    "Caitlyn",
    "Sivir",
    "Jhin",
    "Varus",
    "Kaisa",
    "Xayah",
    "Ezreal",
    "Lucian",
    "Vayne",
    "Tristana",
    "Aphelios",
    "Draven",
    "Kalista",
    "KogMaw",
    "Samira",
    "Nilah",
    "Smolder",
    "Zeri",
  ],
  UTILITY: [
    "Nautilus",
    "Leona",
    "Braum",
    "Alistar",
    "Rell",
    "Thresh",
    "Blitzcrank",
    "Lulu",
    "Janna",
    "Soraka",
    "Nami",
    "Sona",
    "Seraphine",
    "Milio",
    "Karma",
    "Renata",
    "Yuumi",
    "Lux",
    "Morgana",
    "Zyra",
    "Brand",
    "Senna",
    "Pyke",
    "Rakan",
    "Taric",
  ],
};
type Archetype =
  | "marksman"
  | "mage"
  | "fighter"
  | "tank"
  | "enchanter"
  | "assassin";
function archetype(champion: CatalogChampion, role: string): Archetype {
  const has = (tag: string) => champion.tags.includes(tag);
  if (
    role === "UTILITY" &&
    [
      "Lulu",
      "Janna",
      "Soraka",
      "Nami",
      "Sona",
      "Seraphine",
      "Milio",
      "Karma",
      "Renata",
      "Yuumi",
    ].includes(champion.id)
  ) return "enchanter";
  if (role === "UTILITY" && ["Rakan", "Taric"].includes(champion.id)) {
    return "tank";
  }
  if (has("Marksman") && !has("Mage")) return "marksman";
  if (
    has("Tank") &&
    (!has("Fighter") ||
      [
        "Malphite",
        "Amumu",
        "Sejuani",
        "Nunu",
        "Zac",
        "Ornn",
        "Shen",
        "Rell",
        "Nautilus",
        "Leona",
      ].includes(champion.id))
  ) return "tank";
  if (has("Fighter")) return "fighter";
  if (has("Mage")) return "mage";
  return has("Assassin") ? "assassin" : "fighter";
}
const AP_FIGHTERS = [
  "Gwen",
  "Mordekaiser",
  "Lillia",
  "Diana",
  "Shyvana",
  "Rumble",
  "Singed",
  "Udyr",
  "Kayle",
  "Volibear",
];
const RANGED_FIGHTERS = ["Gnar", "Jayce", "Urgot", "Kayle"];
const labels: Record<Archetype, string> = {
  marksman: "daño sostenido a distancia",
  mage: "daño mágico y habilidades",
  fighter: "intercambios prolongados",
  tank: "resistencia e iniciación",
  enchanter: "protección y utilidad",
  assassin: "acceso a objetivos vulnerables",
};
export function buildPreparation(
  input: DraftInput,
  catalog: PreparationCatalog,
  favorites: string[],
  experience: string | null,
  observed: { champion: string; games: number }[],
) {
  const get = (id: string) =>
    catalog.champions.find((champion) => champion.id === id)!;
  const allies = input.allies.map(get), enemies = input.enemies.map(get);
  const occupied = new Set([
    ...input.allies,
    ...input.enemies,
    ...(input.bans ?? []),
  ]);
  const available = input.availableChampions
    ? new Set(input.availableChampions)
    : null;
  const tankMissing = allies.length > 0 &&
    !allies.some((champion) => champion.tags.includes("Tank"));
  const magicMissing = allies.length > 1 &&
    !allies.some((champion) => champion.tags.includes("Mage"));
  const spellThreats = enemies.filter((champion) =>
    champion.tags.includes("Mage")
  );
  const attackThreats = enemies.filter((champion) =>
    champion.tags.includes("Marksman")
  );
  const divers = enemies.filter((champion) =>
    champion.tags.includes("Assassin")
  );
  const frontline = enemies.filter((champion) =>
    champion.tags.includes("Tank")
  );
  const cleanseThreatIds = new Set([
    "Amumu", "Annie", "Ashe", "Leona", "Lissandra", "Lux", "Morgana",
    "Nautilus", "Rell", "Thresh",
  ]);
  const controlThreats = enemies.filter((champion) =>
    cleanseThreatIds.has(champion.id)
  );
  const recommendations = catalog.champions.filter((champion) =>
    !occupied.has(champion.id) && (!available || available.has(champion.id)) &&
    ROLE_POOL[input.role].includes(champion.id)
  ).map((champion) => {
    const games = observed.find((row) => row.champion === champion.id)?.games ??
      0;
    const familiar = favorites.includes(champion.id);
    const reasons = [
      familiar
        ? "Está entre tus campeones habituales declarados."
        : "Forma parte del grupo de opciones revisadas para esta línea.",
    ];
    let score = (familiar ? 20 : 0) + Math.min(games, 5);
    if (games) {
      reasons.push(
        `Tienes ${games} partidas guardadas con este campeón; la muestra no demuestra dominio ni ventaja del enfrentamiento.`,
      );
    }
    if (tankMissing && champion.tags.includes("Tank")) {
      score += 4;
      reasons.push(
        "Tus aliados seleccionados no tienen etiqueta de tanque; aporta una opción de primera línea.",
      );
    }
    if (magicMissing && champion.tags.includes("Mage")) {
      score += 3;
      reasons.push("Añade un perfil de mago al grupo aliado elegido.");
    }
    if (divers.length && champion.tags.includes("Support")) {
      score += 2;
      reasons.push(
        `Ante ${
          divers.map((item) => item.name).join(", ")
        }, considera herramientas para proteger a tus aliados.`,
      );
    }
    if (
      experience === "beginner" &&
      ["Garen", "Annie", "Ashe", "Warwick", "Amumu", "Leona", "Soraka"]
        .includes(champion.id)
    ) {
      score += 3;
      reasons.push(
        "Puede servir para practicar una función clara mientras aprendes las bases.",
      );
    }
    return { champion, reasons, score };
  }).sort((a, b) =>
    b.score - a.score || a.champion.name.localeCompare(b.champion.name)
  ).slice(0, 3).map(({ champion, reasons }) => ({ champion, reasons }));
  const chosen = input.champion
    ? get(input.champion)
    : recommendations[0]?.champion;
  if (!chosen) {
    throw new PreparationValidationError(
      "Elige un campeón para preparar tus compras.",
    );
  }
  const style = archetype(chosen, input.role),
    apFighter = style === "fighter" && AP_FIGHTERS.includes(chosen.id);
  const rangedFighter = RANGED_FIGHTERS.includes(chosen.id);
  const warnings: string[] = [];
  if (!ROLE_POOL[input.role].includes(chosen.id)) {
    warnings.push(
      "Elegiste una combinación de campeón y línea fuera del grupo revisado. Comprueba si esta guía por función encaja con tu estrategia.",
    );
  }
  if (
    [
      "Ezreal",
      "Kaisa",
      "Varus",
      "Senna",
      "Smolder",
      "KogMaw",
      "Kayle",
      "Shyvana",
      "Udyr",
      "Corki",
      "Akali",
    ].includes(chosen.id)
  ) {
    warnings.push(
      "Este campeón admite construcciones con perfiles distintos. La propuesta es una base por función; ajusta la ruta a la variante que quieras jugar.",
    );
  }
  const item = (id: string, reason: string) => {
    const found = catalog.items[id];
    return found && purchasableItem(found)
      ? {
        id,
        name: found.name,
        description: found.description,
        gold: found.gold.total,
        reason,
        components: (found.from ?? []).flatMap((component) => {
          const data = catalog.items[component];
          return data && purchasableItem(data)
            ? [{ id: component, name: data.name, gold: data.gold.total }]
            : [];
        }),
      }
      : null;
  };
  const items = (ids: string[], reason: string) =>
    ids.flatMap((id) => {
      const data = item(id, reason);
      return data ? [data] : [];
    });
  const support = input.role === "UTILITY", jungle = input.role === "JUNGLE";
  const resourceFree = [
    "Akali",
    "Katarina",
    "Vladimir",
    "Rumble",
    "Kennen",
    "Garen",
    "Mordekaiser",
    "Riven",
    "Sett",
    "Shen",
    "Zed",
    "Renekton",
    "Tryndamere",
    "Yasuo",
    "Yone",
    "Aatrox",
    "DrMundo",
    "Briar",
    "Gnar",
  ].includes(chosen.id);
  const starter = items(
    support
      ? ["3865"]
      : jungle
      ? ["1101", "1102", "1103"]
      : style === "mage" || style === "enchanter" || apFighter
      ? resourceFree ? ["1054", "2003"] : ["1056", "2003"]
      : style === "tank"
      ? ["1054", "2003"]
      : ["1055", "2003"],
    support
      ? "Inicio de soporte: prioriza el objeto de misión disponible y la utilidad de tu línea."
      : jungle
      ? "Elige una sola mascota de jungla. Compara sus efectos antes de comprar; no necesitas las tres."
      : "Inicio orientativo para tu función. Compra solo lo que permita tu oro de salida.",
  );
  const coreIds: Record<Archetype, string[]> = {
    marksman: ["6672", "3031", "3094"],
    mage: ["6655", "3089", "3135"],
    fighter: apFighter
      ? ["3115", "4633", "3089"]
      : rangedFighter
      ? ["3071", "3161", "3053"]
      : ["3078", "3053", "6333"],
    tank: ["3068", "2502", "3083"],
    enchanter: ["6617", "3504", "3107"],
    assassin: ["3142", "6694", "3814"],
  };
  if (style === "mage" && resourceFree) coreIds.mage = ["3152", "3089", "3157"];
  if (support && style === "tank") coreIds.tank = ["3190", "3109", "3050"];
  if (style === "assassin" && chosen.info.magic > chosen.info.attack) {
    coreIds.assassin = ["3152", "3089", "3157"];
  }
  const core = items(
    coreIds[style],
    `Ruta base para ${
      labels[style]
    }. Los objetos se compran en secuencia; revisa antes las amenazas y el oro de tu siguiente vuelta a base.`,
  );
  const boots = items(
    [
      ...(style === "marksman"
        ? ["3006"]
        : style === "mage"
        ? ["3020"]
        : ["3158"]),
      "3047",
      "3111",
    ],
    "Elige un solo par: compara daño, reducción de enfriamientos o defensa según quién te amenaza. No asumas que resistencia mágica resuelve todo control.",
  );
  const situational = [
    ...items(
      attackThreats.length
        ? style === "tank" || style === "fighter" ? ["3143", "3110"] : ["3047"]
        : [],
      `Considera defensa frente a ataques de ${
        attackThreats.map((champion) => champion.name).join(", ")
      }, si son una amenaza real durante la partida.`,
    ),
    ...items(
      spellThreats.length
        ? style === "tank" || style === "fighter"
          ? ["3065", "4401"]
          : style === "mage"
          ? ["3102"]
          : ["3156"]
        : [],
      `Compara resistencia mágica ante ${
        spellThreats.map((champion) => champion.name).join(", ")
      }; sus etiquetas no describen todo su daño.`,
    ),
    ...items(
      divers.length
        ? style === "mage" || apFighter
          ? ["3157"]
          : style === "marksman"
          ? ["3026"]
          : ["3190"]
        : [],
      `Reserva una opción defensiva si ${
        divers.map((champion) => champion.name).join(", ")
      } puede alcanzarte.`,
    ),
    ...items(
      frontline.length && ["marksman", "mage", "assassin"].includes(style)
        ? style === "mage" ? ["3135"] : ["3036"]
        : [],
      `Considera penetración si ${
        frontline.map((champion) => champion.name).join(", ")
      } acumula la resistencia correspondiente.`,
    ),
  ].filter((value, index, array) =>
    array.findIndex((candidate) => candidate.id === value.id) === index &&
    !core.some((base) => base.id === value.id)
  );
  if (!starter.length || !core.length) {
    warnings.push(
      "Una parte de la plantilla no está disponible en este parche. No se sustituyeron objetos eliminados por nombres inventados.",
    );
  }
  const templates: Record<
    Archetype,
    { tree: number; ids: number[]; secondary: number; secondaryIds: number[] }
  > = {
    marksman: {
      tree: 8000,
      ids: [8005, 8009, 9104, 8014],
      secondary: 8200,
      secondaryIds: [8233, 8236],
    },
    mage: {
      tree: 8200,
      ids: [8229, 8226, 8210, 8237],
      secondary: 8100,
      secondaryIds: [8126, 8106],
    },
    fighter: {
      tree: 8000,
      ids: [8010, 9111, 9105, 8299],
      secondary: 8400,
      secondaryIds: [8444, 8242],
    },
    tank: {
      tree: 8400,
      ids: [8437, 8446, 8444, 8451],
      secondary: 8300,
      secondaryIds: [8304, 8347],
    },
    enchanter: {
      tree: 8200,
      ids: [8214, 8226, 8210, 8237],
      secondary: 8400,
      secondaryIds: [8463, 8453],
    },
    assassin: {
      tree: 8100,
      ids: [8112, 8143, 8138, 8106],
      secondary: 8200,
      secondaryIds: [8210, 8237],
    },
  };
  const template = { ...templates[style], ids: [...templates[style].ids] };
  const multipleDivers = divers.length >= 2;
  if (!support && !jungle && multipleDivers) {
    template.secondary = 8400;
    template.secondaryIds = [8473, 8453];
  }
  if ((support || jungle) && style === "tank") {
    template.ids[0] = 8439;
    template.ids[1] = 8463;
  }
  if (
    style === "mage" &&
    ["Akali", "Katarina", "Rumble", "Vladimir", "Mordekaiser"].includes(
      chosen.id,
    )
  ) template.ids[1] = 8275;
  const primaryTree = catalog.runes.find((tree) => tree.id === template.tree);
  const secondaryTree = catalog.runes.find((tree) =>
    tree.id === template.secondary
  );
  // Reviewed replacements are considered only when the current slot contains them.
  const replacements: Record<number, number[]> = {
    8138: [8140, 8137, 8141],
    8009: [9111],
    9105: [9104],
    8444: [8473],
    8242: [8451],
  };
  const primary = primaryTree?.slots.map((slot, index) => {
    const options = [
      template.ids[index],
      ...(replacements[template.ids[index]] ?? []),
    ];
    return options.map((id) => slot.runes.find((rune) => rune.id === id)).find((
      rune,
    ) => rune !== undefined);
  }).filter((rune) => rune !== undefined) ?? [];
  // If a template rune disappeared, leave a visible gap to review rather than picking an arbitrary replacement.
  const secondary =
    secondaryTree?.slots.slice(1).flatMap((slot) =>
      slot.runes.filter((rune) => template.secondaryIds.includes(rune.id))
    ).slice(0, 2) ?? [];
  if (primary.length !== 4 || secondary.length !== 2) {
    warnings.push(
      "Una runa de esta plantilla cambió en el catálogo. Completa los espacios indicados en el cliente antes de jugar.",
    );
  }
  const spellKeys = [
    "4",
    jungle
      ? "11"
      : support
      ? "3"
      : input.role === "BOTTOM" && controlThreats.length >= 2
      ? "1"
      : ["TOP", "MIDDLE"].includes(input.role)
      ? "12"
      : "7",
  ];
  const spells = spellKeys.flatMap((key) => {
    const spell = catalog.spells.find((value) => value.key === key);
    return spell
      ? [{
        ...spell,
        reason: key === "11"
          ? "Herramienta de jungla; comprueba sus reglas y mejoras en el cliente."
          : key === "1"
          ? "Purificación puede ayudar contra ciertos efectos de control del equipo rival. Comprueba en el cliente qué efectos elimina."
          : key === "4"
          ? "Movilidad para reposicionarte o responder a una amenaza."
          : key === "12"
          ? "Opción para gestionar el regreso a línea y la presencia en el mapa."
          : key === "3"
          ? "Opción para reducir la amenaza de un rival sobre tu aliado."
          : "Opción de supervivencia para la línea. Acuerda la elección con tu soporte.",
      }]
      : [];
  });
  const alternatives = catalog.spells.filter((spell) =>
    ["1", "7", "14", "3", "6", "21"].includes(spell.key) &&
    !spellKeys.includes(spell.key)
  ).map((spell) => ({
    ...spell,
    reason: spell.key === "1" && controlThreats.length
      ? `Considérala ante el control de ${controlThreats.map((champion) => champion.name).join(", ")}; verifica qué efectos elimina.`
      : spell.key === "3" && divers.length
      ? `Puede ayudar contra las entradas de ${divers.map((champion) => champion.name).join(", ")}.`
      : spell.key === "7"
      ? "Opción de supervivencia para intercambios y peleas cercanas."
      : "Alternativa situacional; compara su efecto con la amenaza del draft.",
  }));
  return {
    version: catalog.version,
    input,
    chosen,
    autoSelected: !input.champion,
    recommendations,
    method:
      "Campeón, hechizos y ruta de objetos: reglas revisadas y preferencias del jugador. Runas: página de estadísticas del campeón y línea cuando la fuente está disponible. Las tasas describen la muestra de esa página y no predicen quién ganará; Data Dragon aporta el catálogo.",
    composition: [
      allies.length
        ? `Aliados elegidos: ${
          allies.map((champion) => champion.name).join(", ")
        }.`
        : "Añade aliados para considerar la composición.",
      enemies.length
        ? `Rivales elegidos: ${
          enemies.map((champion) => champion.name).join(", ")
        }. Las etiquetas de clase orientan opciones; no confirman la build ni el tipo exacto de daño.`
        : "Sin rivales elegidos: se muestra una base general.",
      `Tu función: ${ROLE_LABELS[input.role]} · ${labels[style]}.`,
    ],
    starter,
    core,
    boots,
    situational,
    runes: {
      primaryTree: primaryTree
        ? { name: primaryTree.name, icon: primaryTree.icon }
        : null,
      primary,
      secondaryTree: secondaryTree
        ? { name: secondaryTree.name, icon: secondaryTree.icon }
        : null,
      secondary,
      reason: multipleDivers
        ? `Plantilla para ${labels[style]} con runas secundarias defensivas frente a ${divers.map((champion) => champion.name).join(", ")}. Ajusta los fragmentos a tu campeón y confirma la elección en el cliente.`
        : `Punto de partida para ${labels[style]}. Comprueba que puedes activar la clave con tu patrón de intercambio. Ajusta las runas y los fragmentos a tu campeón y al enfrentamiento en el cliente.`,
    },
    spells,
    alternatives,
    purchasePlan: [
      "Salida: elige un inicio compatible con tu línea y conserva oro para lo que realmente puedas comprar.",
      `Primera vuelta: prioriza un componente útil de ${
        core[0]?.name ?? "tu objeto principal"
      }, o defensa si te permite sostener la línea. No esperes el objeto completo si puedes obtener una ventaja antes.`,
      "Durante la partida: completa un objeto y un par de botas según tus necesidades. Las opciones situacionales sustituyen compras de la ruta; no se añaden todas a un inventario de seis espacios.",
      "Antes de un objetivo: compra con tiempo, revisa tu visión y reúne al equipo. Los costes mostrados son precios completos, no tu saldo pendiente.",
    ],
    warnings,
  };
}
