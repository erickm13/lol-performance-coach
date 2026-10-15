// Catálogo inicial de la Academia: conceptos de League of Legends con el término
// que usa la comunidad LATAM (casi siempre en inglés) y sus alias en español o
// spanglish, para reconocerlos en el chat, los planes y los análisis.
//
// - `id` es estable: no lo cambies una vez publicado (lo usan enlaces y anclas).
// - `category` coincide con las categorías del motor de debilidades
//   (CATEGORIES en training.ts) para enlazar cada hallazgo con sus conceptos;
//   `general` agrupa fases, roles y jerga sin categoría propia.
// - `patchSensitive` marca conceptos que cambian entre temporadas/parches
//   (monstruos épicos, placas): verifícalos contra el parche actual.

export type AcademyCategory =
  | "farming"
  | "vision"
  | "early_game"
  | "objectives"
  | "consistency"
  | "general";

export type AcademyTerm = {
  id: string;
  term: string;
  aliases: string[];
  category: AcademyCategory;
  definition: string;
  patchSensitive?: boolean;
};

export const ACADEMY_TERMS: AcademyTerm[] = [
  // ---------- Farming y oleadas ----------
  {
    id: "last-hit",
    term: "Last hit",
    aliases: ["último golpe", "lasthitear"],
    category: "farming",
    definition: "Dar el golpe final al súbdito para cobrar su oro.",
  },
  {
    id: "cs",
    term: "CS",
    aliases: ["cs por minuto", "cs/min", "farm", "farmeo", "farmear"],
    category: "farming",
    definition: "Súbditos y monstruos que matas; se mide por minuto.",
  },
  {
    id: "wave-management",
    term: "Wave management",
    aliases: ["control de oleadas", "manejo de oleadas"],
    category: "farming",
    definition: "Decidir hacia dónde y a qué ritmo se mueve la oleada.",
  },
  {
    id: "freeze",
    term: "Freeze",
    aliases: ["congelar", "freezear", "congelar la oleada"],
    category: "farming",
    definition:
      "Mantener la oleada cerca de tu torre para farmear seguro y negarle oro al rival.",
  },
  {
    id: "slow-push",
    term: "Slow push",
    aliases: ["empuje lento"],
    category: "farming",
    definition:
      "Acumular súbditos para que llegue una oleada grande a la torre rival.",
  },
  {
    id: "fast-push",
    term: "Fast push",
    aliases: ["shove", "pushear", "empuje rápido"],
    category: "farming",
    definition: "Limpiar la oleada rápido para quedar libre y moverte.",
  },
  {
    id: "wave-bounce",
    term: "Wave bounce",
    aliases: ["rebote de oleada"],
    category: "farming",
    definition: "La oleada que golpea la torre regresa sola hacia tu lado.",
  },
  {
    id: "tower-farming",
    term: "Tower farming",
    aliases: ["farmear bajo torre"],
    category: "farming",
    definition: "Calcular cuántos golpes de torre necesita cada súbdito.",
  },
  {
    id: "recall-timing",
    term: "Recall timing",
    aliases: ["back timing", "backear", "regresar a base"],
    category: "farming",
    definition: "Volver a base sin perder oleadas ni experiencia.",
  },
  {
    id: "jungle-pathing",
    term: "Jungle pathing",
    aliases: ["ruta de jungla", "pathing", "full clear", "clear"],
    category: "farming",
    definition: "Orden en que el jungla limpia sus campamentos.",
  },

  // ---------- Visión ----------
  {
    id: "ward",
    term: "Ward",
    aliases: ["centinela", "wardear"],
    category: "vision",
    definition: "Da visión de una zona durante un tiempo.",
  },
  {
    id: "control-ward",
    term: "Control ward",
    aliases: ["pink", "pink ward", "guardián de control"],
    category: "vision",
    definition:
      "Centinela permanente que revela y desactiva los centinelas enemigos.",
  },
  {
    id: "trinket",
    term: "Trinket",
    aliases: ["baratija"],
    category: "vision",
    definition: "Objeto gratuito de visión.",
  },
  {
    id: "sweeper",
    term: "Sweeper",
    aliases: ["oracle lens", "lente", "lente del oráculo", "barrer"],
    category: "vision",
    definition: "Revela y permite destruir centinelas enemigos.",
  },
  {
    id: "vision-score",
    term: "Vision score",
    aliases: ["puntuación de visión"],
    category: "vision",
    definition: "Mide cuánta visión diste y negaste en la partida.",
  },
  {
    id: "deep-ward",
    term: "Deep ward",
    aliases: ["ward profundo"],
    category: "vision",
    definition:
      "Centinela en la jungla rival para seguir los movimientos del jungla enemigo.",
  },
  {
    id: "brush-control",
    term: "Brush control",
    aliases: ["control de arbustos"],
    category: "vision",
    definition: "Tener visión de los arbustos clave de tu línea o del río.",
  },
  {
    id: "objective-setup",
    term: "Objective setup",
    aliases: ["setup", "preparar visión"],
    category: "vision",
    definition: "Preparar visión 60–90 s antes de dragón o Barón.",
  },

  // ---------- Early game ----------
  {
    id: "trade",
    term: "Trade",
    aliases: ["trading", "tradear", "intercambio"],
    category: "early_game",
    definition:
      "Pelea corta en línea en la que buscas hacer más daño del que recibes.",
  },
  {
    id: "all-in",
    term: "All-in",
    aliases: ["ir all-in", "allin"],
    category: "early_game",
    definition: "Usar todo tu kit para intentar matar al rival.",
  },
  {
    id: "gank",
    term: "Gank",
    aliases: ["gankear", "gankeo"],
    category: "early_game",
    definition: "Ataque sorpresa de otro jugador en tu línea.",
  },
  {
    id: "counter-gank",
    term: "Counter-gank",
    aliases: ["contragank", "contragankear"],
    category: "early_game",
    definition: "Responder a un gank enemigo con tu propio jungla.",
  },
  {
    id: "dive",
    term: "Dive",
    aliases: ["tower dive", "divear", "bucear"],
    category: "early_game",
    definition: "Atacar a un rival que está bajo su propia torre.",
  },
  {
    id: "lane-priority",
    term: "Lane priority",
    aliases: ["prio", "prioridad", "prioridad de línea"],
    category: "early_game",
    definition: "Empujar primero para poder moverte antes que tu rival.",
  },
  {
    id: "power-spike",
    term: "Power spike",
    aliases: ["spike", "pico de poder"],
    category: "early_game",
    definition:
      "Momento (nivel 2, 3, 6 u objeto clave) en que tu campeón se vuelve más fuerte.",
  },
  {
    id: "invade",
    term: "Invade",
    aliases: ["invadir", "invasión", "invade nivel 1"],
    category: "early_game",
    definition: "Entrar a la jungla rival, típicamente en nivel 1.",
  },
  {
    id: "flash-timer",
    term: "Flash timer",
    aliases: ["timear flash", "timer de flash"],
    category: "early_game",
    definition:
      "Anotar cuándo el rival usó Flash para saber cuándo vuelve a tenerlo.",
  },
  {
    id: "first-blood",
    term: "First blood",
    aliases: ["fb", "primera sangre"],
    category: "early_game",
    definition: "Primera baja de la partida.",
  },
  {
    id: "win-lane",
    term: "Win lane",
    aliases: ["ganar línea", "ganar lane"],
    category: "early_game",
    definition: "Terminar la fase de líneas con ventaja.",
  },

  // ---------- Objectives y macro ----------
  {
    id: "drake",
    term: "Drake",
    aliases: ["dragon", "dragón", "dragon soul", "alma del dragón", "alma"],
    category: "objectives",
    definition:
      "Monstruo que da mejoras permanentes; con cuatro se obtiene el Alma.",
    patchSensitive: true,
  },
  {
    id: "baron",
    term: "Baron",
    aliases: ["nashor", "barón", "barón nashor"],
    category: "objectives",
    definition: "Monstruo tardío que da una mejora fuerte para asediar.",
    patchSensitive: true,
  },
  {
    id: "herald",
    term: "Herald",
    aliases: ["rift herald", "heraldo", "heraldo de la grieta"],
    category: "objectives",
    definition: "Monstruo que ayuda a derribar torres.",
    patchSensitive: true,
  },
  {
    id: "voidgrubs",
    term: "Voidgrubs",
    aliases: ["grubs", "larvas", "larvas del vacío"],
    category: "objectives",
    definition:
      "Monstruos tempranos que dan daño extra contra estructuras.",
    patchSensitive: true,
  },
  {
    id: "tower-plates",
    term: "Tower plates",
    aliases: ["plates", "placas", "placas de torre"],
    category: "objectives",
    definition: "Oro extra por dañar torres antes del minuto 14.",
    patchSensitive: true,
  },
  {
    id: "rotation",
    term: "Rotation",
    aliases: ["rotate", "rotar", "rotación"],
    category: "objectives",
    definition:
      "Moverte a otra parte del mapa para ayudar o tomar un objetivo.",
  },
  {
    id: "cross-map",
    term: "Cross-map",
    aliases: ["objective trade", "tradear objetivos", "cambio de objetivos"],
    category: "objectives",
    definition: "Tomar un objetivo en un lado mientras el rival toma otro.",
  },
  {
    id: "split-push",
    term: "Split push",
    aliases: ["splitear", "split", "splitpush"],
    category: "objectives",
    definition: "Presionar una línea lateral en solitario.",
  },
  {
    id: "win-condition",
    term: "Win condition",
    aliases: ["wincon", "condición de victoria"],
    category: "objectives",
    definition: "Lo que tu equipo necesita para ganar esa partida en concreto.",
  },
  {
    id: "macro",
    term: "Macro",
    aliases: ["juego macro"],
    category: "objectives",
    definition: "Decisiones de mapa: dónde estar, qué objetivo tomar y cuándo.",
  },
  {
    id: "micro",
    term: "Micro",
    aliases: ["mecánicas", "juego micro"],
    category: "objectives",
    definition: "Mecánicas individuales: habilidades, movimiento y combos.",
  },
  {
    id: "tempo",
    term: "Tempo",
    aliases: [],
    category: "objectives",
    definition: "Usar mejor que el rival el tiempo entre acciones.",
  },

  // ---------- Teamfight y consistency ----------
  {
    id: "kiting",
    term: "Kiting",
    aliases: ["kite", "kitear", "kiteo"],
    category: "consistency",
    definition: "Atacar y moverte para mantener la distancia con el rival.",
  },
  {
    id: "teamfight",
    term: "Teamfight",
    aliases: ["tf", "pelea en equipo"],
    category: "consistency",
    definition: "Pelea grupal de 4 o 5 jugadores por bando.",
  },
  {
    id: "engage",
    term: "Engage",
    aliases: ["engagear", "iniciar"],
    category: "consistency",
    definition: "Comenzar una pelea con ventaja.",
  },
  {
    id: "disengage",
    term: "Disengage",
    aliases: ["disengagear", "retirarse"],
    category: "consistency",
    definition: "Evitar o cortar una pelea que no te conviene.",
  },
  {
    id: "peel",
    term: "Peel",
    aliases: ["peelear", "proteger"],
    category: "consistency",
    definition: "Mantener a los enemigos lejos de tu carry.",
  },
  {
    id: "crowd-control",
    term: "CC",
    aliases: ["crowd control", "control de masas"],
    category: "consistency",
    definition:
      "Aturdimientos, ralentizaciones y otros efectos que limitan al rival.",
  },
  {
    id: "poke",
    term: "Poke",
    aliases: ["pokear"],
    category: "consistency",
    definition: "Daño a distancia antes de que empiece la pelea.",
  },
  {
    id: "focus",
    term: "Focus",
    aliases: ["focusear"],
    category: "consistency",
    definition: "Concentrar el daño del equipo en un objetivo.",
  },
  {
    id: "kill-participation",
    term: "Kill participation",
    aliases: ["kp", "participación en asesinatos"],
    category: "consistency",
    definition:
      "Porcentaje de las bajas de tu equipo en las que participaste.",
  },
  {
    id: "kda",
    term: "KDA",
    aliases: [],
    category: "consistency",
    definition: "(Kills + Assists) / Deaths.",
  },
  {
    id: "tilt",
    term: "Tilt",
    aliases: ["tiltearse", "tilteado"],
    category: "consistency",
    definition: "Frustración que empeora tus decisiones.",
  },
  {
    id: "throw",
    term: "Throw",
    aliases: ["throwear", "regalar la partida"],
    category: "consistency",
    definition: "Perder una ventaja por una mala decisión.",
  },
  {
    id: "feed",
    term: "Feed",
    aliases: ["feedear", "feeder"],
    category: "consistency",
    definition: "Morir seguido y darle oro y experiencia al rival.",
  },
  {
    id: "flame",
    term: "Flame",
    aliases: ["flamear"],
    category: "consistency",
    definition:
      "Insultar o culpar en el chat; daña la comunicación y el rendimiento del equipo.",
  },
  {
    id: "int",
    term: "Int",
    aliases: ["intear", "inting"],
    category: "consistency",
    definition: "Morir a propósito o jugar sin intención de ganar.",
  },
  {
    id: "vod-review",
    term: "VOD review",
    aliases: ["revisar replays", "revisión de repetición", "replay"],
    category: "consistency",
    definition: "Revisar tus partidas para encontrar errores repetidos.",
  },

  // ---------- General: fases, roles y jerga ----------
  {
    id: "early-game",
    term: "Early game",
    aliases: ["early", "juego temprano"],
    category: "general",
    definition: "Primera fase de la partida, centrada en las líneas.",
  },
  {
    id: "mid-game",
    term: "Mid game",
    aliases: ["juego medio"],
    category: "general",
    definition:
      "Fase en que caen las primeras torres y empiezan las rotaciones.",
  },
  {
    id: "late-game",
    term: "Late game",
    aliases: ["late", "juego tardío"],
    category: "general",
    definition:
      "Fase final: equipos completos y peleas por Barón y estructuras.",
  },
  {
    id: "scaling",
    term: "Scaling",
    aliases: ["escalar", "escalado"],
    category: "general",
    definition: "Campeón que gana fuerza a medida que avanza la partida.",
  },
  {
    id: "snowball",
    term: "Snowball",
    aliases: ["snowballear", "bola de nieve"],
    category: "general",
    definition: "Convertir una ventaja en ventajas cada vez mayores.",
  },
  {
    id: "bounty",
    term: "Bounty",
    aliases: ["recompensa"],
    category: "general",
    definition: "Oro extra por cortar la racha de un rival.",
  },
  {
    id: "stack",
    term: "Stack",
    aliases: ["stackear", "cargas"],
    category: "general",
    definition: "Acumular cargas de una habilidad u objeto.",
  },
  {
    id: "dodge",
    term: "Dodge",
    aliases: ["dodgear"],
    category: "general",
    definition:
      "Salir de la selección de campeones antes de que empiece la partida.",
  },
  {
    id: "ff",
    term: "FF",
    aliases: ["forfeit", "rendirse", "ff15"],
    category: "general",
    definition: "Votar para rendirse.",
  },
  {
    id: "top",
    term: "Top",
    aliases: ["toplaner", "línea superior"],
    category: "general",
    definition: "Línea superior; suele ocuparla un luchador o tanque.",
  },
  {
    id: "jungle",
    term: "Jungle",
    aliases: ["jungla", "jg", "jungler"],
    category: "general",
    definition: "Rol que recorre la jungla, controla objetivos y ayuda en las líneas.",
  },
  {
    id: "mid",
    term: "Mid",
    aliases: ["midlaner", "línea central"],
    category: "general",
    definition: "Línea central, la más corta y con más rotaciones.",
  },
  {
    id: "adc",
    term: "ADC",
    aliases: ["bot", "tirador", "marksman"],
    category: "general",
    definition: "Tirador de la línea inferior; daño constante a distancia.",
  },
  {
    id: "support",
    term: "Support",
    aliases: ["supp", "soporte"],
    category: "general",
    definition: "Rol que protege, da visión y crea oportunidades al equipo.",
  },
  {
    id: "carry",
    term: "Carry",
    aliases: ["carrear", "carrear la partida"],
    category: "general",
    definition: "Jugador del que depende el daño; carrear es ganar cargando al equipo.",
  },
  {
    id: "tank",
    term: "Tank",
    aliases: ["tanque", "tankear"],
    category: "general",
    definition: "Campeón resistente que recibe el daño por el equipo.",
  },
];

/** Normaliza para comparar sin mayúsculas ni tildes. */
export function normalizeAcademyText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Índice término/alias normalizado → id. */
export const ACADEMY_INDEX: Record<string, string> = Object.fromEntries(
  ACADEMY_TERMS.flatMap((t) =>
    [t.term, ...t.aliases].map((name) => [normalizeAcademyText(name), t.id])
  ),
);

export function findAcademyTerm(text: string): AcademyTerm | undefined {
  const id = ACADEMY_INDEX[normalizeAcademyText(text)];
  return id ? ACADEMY_TERMS.find((t) => t.id === id) : undefined;
}
