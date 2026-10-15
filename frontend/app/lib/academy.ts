import { ACADEMY_TERMS } from "./academyTerms";
export type AcademyResource = {
  title: string;
  author: string;
  url: string;
  kind: "video" | "curso" | "lectura";
  language: string;
  year: number | null;
  focus: string;
};
export type AcademyArticle = {
  slug: string;
  title: string;
  aliases: string[];
  category: string;
  definition: string;
  when: string;
  steps: string[];
  pitfalls: string[];
  exercise: string;
  check: string;
  related: string[];
  resources: AcademyResource[];
};
const wave: AcademyResource = {
  title: "Wave Control Guide",
  author: "Skill Capped Challenger LoL Guides",
  url: "https://www.youtube.com/watch?v=p9ZUxaCpvjc&t=64s",
  kind: "video",
  language: "Inglés",
  year: 2021,
  focus:
    "Observa cómo cambia el tamaño y la posición de la oleada antes de decidir qué hacer.",
};
const gank: AcademyResource = {
  title: "Ganking Guide",
  author: "Skill Capped Challenger LoL Guides",
  url: "https://www.youtube.com/watch?v=RoY-ddiKoxk",
  kind: "video",
  language: "Inglés",
  year: null,
  focus:
    "Compara la preparación del acercamiento con la situación de la línea.",
};
const kite: AcademyResource = {
  title: "How To Attack Move · Complete Guide",
  author: "Zadarkus",
  url: "https://www.youtube.com/watch?v=ASpfEUAnQyQ",
  kind: "video",
  language: "Inglés",
  year: 2022,
  focus:
    "Fíjate en la alternancia entre ataque y desplazamiento. Es una guía de un creador, no una demostración atribuida a un profesional.",
};
const core: AcademyResource = {
  title: "CoreJJ Teaches Carrying As Support",
  author: "CoreJJ · campeón mundial 2017",
  url: "https://aimlabs.com/courses/7IeultcsJG4RYIS6L8tPtc",
  kind: "curso",
  language: "Inglés",
  year: 2022,
  focus:
    "Lecciones sobre visión, línea y roaming de un jugador profesional. El proveedor puede requerir registro o pago.",
};
const practice: AcademyResource = {
  title:
    "The Fundamentals for Improving at League of Legends as an Average Player",
  author: "dsizzlesmcc · Dignitas",
  url:
    "https://dignitas.gg/articles/the-fundamentals-for-improving-at-league-of-legends-as-an-average-player",
  kind: "lectura",
  language: "Inglés",
  year: 2020,
  focus:
    "Una propuesta para elegir un objetivo de aprendizaje y revisar si lo aplicaste en tu partida.",
};
const attackMove: AcademyResource = {
  title: "How to ATTACK MOVE & KITE like a PRO",
  author: "Skill Capped Challenger LoL Guides",
  url: "https://www.youtube.com/watch?v=-oyxOgtT33U",
  kind: "video",
  language: "Inglés",
  year: 2021,
  focus:
    "Compara la orden de ataque y movimiento con tus controles actuales y practica una configuración antes de cambiar varias a la vez.",
};
const freezeGuide: AcademyResource = {
  title: "How to FREEZE · Manage Waves to Challenger",
  author: "Skill Capped Challenger LoL Guides",
  url: "https://www.youtube.com/watch?v=wjD2rGFua8s",
  kind: "video",
  language: "Inglés",
  year: null,
  focus:
    "Una segunda explicación de la congelación para contrastarla con el empuje lento o rápido. El video pertenece a temporadas anteriores; céntrate en el manejo de la oleada.",
};
const jungleGanks: AcademyResource = {
  title: "Ultimate Ganking Guide · How To Gank Successfully With Any Jungler",
  author: "Virkayu",
  url: "https://www.youtube.com/watch?v=-4IQG7vocKk",
  kind: "video",
  language: "Inglés",
  year: null,
  focus:
    "Observa qué condiciones de la línea favorecen la intervención del jungla y cuándo compensa continuar tu ruta.",
};
const wards: AcademyResource = {
  title: "3 Minute Warding Guide",
  author: "3 Minute League of Legends",
  url: "https://www.youtube.com/watch?v=sVrw5Ikgv3Y",
  kind: "video",
  language: "Inglés",
  year: 2022,
  focus:
    "Introducción breve a la visión en líneas y objetivos. Usa las ubicaciones como ejemplos históricos y comprueba el terreno de tu parche.",
};
const itemization: AcademyResource = {
  title: "Everything You Need To Know About League of Legends Itemization",
  author: "xPetu",
  url: "https://www.youtube.com/watch?v=60hSIrt8LsE&t=477s",
  kind: "video",
  language: "Inglés",
  year: 2025,
  focus:
    "Desde 7:57, revisa la elección del primer componente y su relación con tu primera vuelta a base. Los valores de los objetos pertenecen al parche del video.",
};
const LESSONS: AcademyArticle[] = [
  {
    slug: "kiteo",
    title: "Kiteo",
    aliases: ["kiteo", "kitear", "kiting", "attack move", "orbwalking"],
    category: "Mecánicas",
    definition:
      "Alternar ataques básicos con desplazamientos para mantener una distancia útil sin perder ataques por cancelar su animación.",
    when:
      "Cuando necesitas hacer daño mientras retrocedes, persigues o esquivas. La distancia depende de tu alcance y de las amenazas que todavía puede usar el rival.",
    steps: [
      "Ataca un objetivo dentro de tu alcance y espera a que salga el proyectil o se complete el golpe.",
      "Muévete durante el intervalo hasta tu siguiente ataque; elige una dirección que mantenga una salida.",
      "Repite sin forzar un ataque si te expone a una habilidad peligrosa. Practica también con la orden de atacar y moverse.",
    ],
    pitfalls: [
      "Moverte antes de que salga el ataque y cancelarlo.",
      "Retroceder hacia un muro o acercarte para pegar al objetivo equivocado.",
    ],
    exercise:
      "En la herramienta de práctica, alterna ataque y movimiento alrededor de un muñeco durante tres tandas de un minuto. Empieza despacio y aumenta la velocidad cuando dejes de cancelar ataques.",
    check:
      "¿Completaste los ataques manteniendo la distancia y una ruta de salida?",
    related: ["posicionamiento", "late-game"],
    resources: [kite, attackMove],
  },
  {
    slug: "control-de-oleadas",
    title: "Control de oleadas",
    aliases: [
      "control de oleadas",
      "gestión de oleadas",
      "wave management",
      "wave control",
    ],
    category: "Línea",
    definition:
      "Elegir cuánto y cuándo dañar a los súbditos para influir en dónde se encuentran las oleadas y en qué momento puedes salir de la línea.",
    when:
      "Antes de regresar a base, preparar un gank, moverte a un objetivo o hacer que el rival se exponga para farmear.",
    steps: [
      "Identifica hacia qué lado avanza la oleada y cuántos súbditos quedan de cada equipo.",
      "Define tu siguiente acción: quedarte, comprar o desplazarte.",
      "Elige freeze, slow push o fast push según esa acción y la presión del rival. Comprueba que puedes ejecutar el plan sin morir.",
    ],
    pitfalls: [
      "Empujar por costumbre sin saber qué harás después.",
      "Salir de línea con una oleada que el rival puede congelar lejos de tu torre.",
    ],
    exercise:
      "En tus próximas tres vueltas a base, anota si la oleada llegó a la torre rival y cuántos súbditos perdiste al regresar.",
    check: "¿La posición de la oleada facilitó la acción que habías planeado?",
    related: ["freeze", "slow-push", "fast-push", "tempo"],
    resources: [wave, freezeGuide],
  },
  {
    slug: "freeze",
    title: "Freeze · congelar la oleada",
    aliases: [
      "freeze",
      "freezing",
      "congelar la oleada",
      "congelación de oleada",
    ],
    category: "Línea",
    definition:
      "Mantener el encuentro de súbditos cerca de una posición favorable ajustando el daño que haces y conservando suficiente presión de la oleada rival.",
    when:
      "Cuando quieres farmear cerca de tu torre o hacer que el rival avance. Debes poder sostener esa posición y responder a un empuje o a una salida del enemigo.",
    steps: [
      "Deja una ventaja de súbditos rivales acorde con la distancia a la torre y la llegada de refuerzos.",
      "Da los últimos golpes y reduce el exceso de daño antes de que la oleada entre en la torre.",
      "Si el rival abandona la línea, evalúa si mantenerla te compensa más que empujar y responder.",
    ],
    pitfalls: [
      "Seguir una cantidad fija de súbditos sin mirar su vida ni la distancia.",
      "Recibir demasiado daño por intentar congelar sin apoyo.",
    ],
    exercise:
      "En práctica, intenta sostener la oleada fuera del alcance de tu torre durante dos encuentros de refuerzos. Ajusta el daño en lugar de memorizar un número.",
    check:
      "¿La oleada permaneció en la zona elegida sin costarte demasiada vida?",
    related: ["control-de-oleadas", "fast-push"],
    resources: [{
      ...wave,
      url: "https://www.youtube.com/watch?v=p9ZUxaCpvjc&t=226s",
      focus:
        "Capítulo de congelación, desde 3:46. Observa los ajustes de daño a los súbditos.",
    }, freezeGuide],
  },
  {
    slug: "slow-push",
    title: "Slow push · empuje lento",
    aliases: ["slow push", "slowpush", "empuje lento"],
    category: "Línea",
    definition:
      "Acumular una ventaja gradual de súbditos para que varias oleadas avancen juntas y creen una ventana de presión.",
    when:
      "Para preparar una compra, presionar una torre o salir de línea después de hacer que la oleada acumulada llegue a la torre rival.",
    steps: [
      "Genera una pequeña ventaja de súbditos y evita limpiar demasiado rápido.",
      "Acompaña la acumulación sin exponerte a un gank.",
      "Cuando necesites la ventana, acelera el empuje para completar el choque bajo torre antes de salir.",
    ],
    pitfalls: [
      "Dejar la oleada a medio camino y regalar un freeze.",
      "Intentar acumular bajo presión sin visión ni capacidad de disputar la línea.",
    ],
    exercise:
      "Prepara una oleada acumulada antes de una compra y revisa si llegó completa a la torre rival.",
    check:
      "¿Conseguiste tiempo para comprar o moverte sin perder el siguiente encuentro?",
    related: ["control-de-oleadas", "tempo"],
    resources: [{
      ...wave,
      url: "https://www.youtube.com/watch?v=p9ZUxaCpvjc&t=737s",
      focus:
        "Capítulo de slow push, desde 12:17. Sigue la acumulación de súbditos.",
    }, freezeGuide],
  },
  {
    slug: "fast-push",
    title: "Fast push · empuje rápido",
    aliases: ["fast push", "fastpush", "empuje rápido", "crashear la oleada"],
    category: "Línea",
    definition:
      "Eliminar la oleada rival con rapidez para que la tuya avance, idealmente hasta su torre, antes de tu siguiente acción.",
    when:
      "Cuando necesitas comprar, responder a una jugada o castigar que tu rival se haya ido. Revisa primero si tienes recursos y seguridad para terminar el empuje.",
    steps: [
      "Comprueba dónde está el rival y qué recursos necesitas para limpiar.",
      "Daño a varios súbditos y últimos golpes deben servir al objetivo de terminar a tiempo.",
      "Confirma que la oleada llegó a torre y aprovecha la ventana; evita quedarte sin un motivo.",
    ],
    pitfalls: [
      "Gastar todo tu maná y quedar expuesto.",
      "Pensar que empujar siempre permite moverse primero aunque el rival ya haya salido.",
    ],
    exercise:
      "Antes de una compra, calcula si puedes completar el empuje. Después comprueba si el rival pudo detenerlo fuera de su torre.",
    check: "¿Terminaste antes de perder la ventana que querías aprovechar?",
    related: ["tempo", "control-de-oleadas"],
    resources: [{
      ...wave,
      url: "https://www.youtube.com/watch?v=p9ZUxaCpvjc&t=84s",
      focus:
        "Capítulo de fast push, desde 1:24. Observa el momento de acelerar el daño.",
    }, freezeGuide],
  },
  {
    slug: "gankeo",
    title: "Gankeo",
    aliases: ["gankeo", "gankear", "gank", "ganks", "ganking"],
    category: "Jungla y mapa",
    definition:
      "Intervenir en otra línea para crear una ventaja temporal con un aliado: presión, recursos del rival, una baja o espacio para un objetivo.",
    when:
      "Cuando la posición de la oleada, la vida, las herramientas de control y la información del jungla rival hacen razonable la intervención.",
    steps: [
      "Revisa si tu aliado puede seguirte y qué escapes puede tener el enemigo.",
      "Elige una entrada y una salida considerando la información disponible de visión.",
      "Decide cuándo abandonar si no hay oportunidad; después de la jugada, ayuda a resolver la oleada cuando convenga.",
    ],
    pitfalls: [
      "Esperar demasiado y perder campamentos u objetivos sin beneficio.",
      "Entrar sin mirar la oleada, la vida del aliado o un posible contragank.",
    ],
    exercise:
      "Revisa tres intentos tuyos: qué sabías antes de entrar, cuánto tiempo invertiste y qué ganaste aunque no hubiera una baja.",
    check:
      "¿La intervención generó una ventaja mayor que su coste de tiempo y recursos?",
    related: ["vision", "tempo", "control-de-oleadas"],
    resources: [gank, jungleGanks],
  },
  {
    slug: "early-game",
    title: "Early game · juego temprano",
    aliases: ["early game", "early", "juego temprano", "fase de líneas"],
    category: "Fases",
    definition:
      "La etapa inicial en la que construyes tus primeros recursos y ventajas de línea o jungla. Su final depende del estado del mapa, no de un minuto universal.",
    when:
      "Al planear los primeros niveles, rutas, compras y ventanas de ayuda a tus compañeros.",
    steps: [
      "Define un objetivo pequeño para tu rol y campeón, como conservar vida para una oleada importante.",
      "Revisa el mapa en momentos seguros y respeta la información que falta del jungla rival.",
      "Compra y vuelve a tu zona con una oleada o ruta que reduzca pérdidas.",
    ],
    pitfalls: [
      "Pelear por inercia sin comparar niveles ni recursos.",
      "Convertir una muerte temprana en varias por volver a disputar sin ventaja.",
    ],
    exercise:
      "Elige una sola decisión de tus primeros diez minutos y anota qué información usaste antes de tomarla.",
    check:
      "¿Tu decisión protegió recursos o creó una ventaja que podías aprovechar?",
    related: ["control-de-oleadas", "gankeo", "compras"],
    resources: [gank, jungleGanks, practice],
  },
  {
    slug: "mid-game",
    title: "Mid game · juego medio",
    aliases: ["mid game", "midgame", "juego medio"],
    category: "Fases",
    definition:
      "La transición hacia un mapa más abierto, con rotaciones, asignación de líneas y preparación conjunta de objetivos.",
    when:
      "Cuando caer una torre cambia las zonas seguras de farmeo y necesitas coordinar tu siguiente movimiento con el equipo.",
    steps: [
      "Identifica qué línea puedes recoger de forma segura y quién cubre las otras.",
      "Antes de moverte, relaciona oleadas, compras y el siguiente objetivo que el equipo pueda disputar.",
      "Prepara la entrada con aliados y visión en lugar de caminar solo por zonas desconocidas.",
    ],
    pitfalls: [
      "Agruparse sin recoger oleadas y perder recursos gratis.",
      "Confundir tener un objetivo disponible con poder disputarlo.",
    ],
    exercise:
      "Antes de dos objetivos, anota dónde estaban tus oleadas y si pudiste comprar antes de reunirte con el equipo.",
    check: "¿Llegaste con recursos y una entrada preparada?",
    related: ["tempo", "vision", "posicionamiento"],
    resources: [wards, jungleGanks, core, practice],
  },
  {
    slug: "late-game",
    title: "Late game · juego tardío",
    aliases: ["late game", "late", "juego tardío", "juego final"],
    category: "Fases",
    definition:
      "La etapa avanzada en la que muchas decisiones afectan directamente al cierre de la partida y las bajas pueden abrir ventanas largas para el rival.",
    when:
      "Cuando tu equipo tiene que equilibrar presión de líneas, compras y presencia para una pelea decisiva.",
    steps: [
      "Reconoce qué amenaza rival puede impedir que cumplas tu función.",
      "Mantén una posición desde la que puedas participar y una ruta para retroceder.",
      "Después de una ventaja, compara oleadas, estructuras y objetivos para elegir una conversión concreta.",
    ],
    pitfalls: [
      "Entrar solo por visión cuando perderte impide disputar el objetivo.",
      "Perseguir una baja y perder la oportunidad de cerrar o preparar el mapa.",
    ],
    exercise:
      "Revisa tu última pelea importante: pausa antes del primer contacto y señala tu amenaza principal y tu salida.",
    check:
      "¿Tu posición te permitió cumplir tu función sin exponerte antes de tiempo?",
    related: ["posicionamiento", "kiteo", "vision"],
    resources: [kite, attackMove, core],
  },
  {
    slug: "vision",
    title: "Visión",
    aliases: [
      "visión",
      "vision",
      "wardear",
      "warding",
      "control ward",
      "wards",
      "ward",
    ],
    category: "Jungla y mapa",
    definition:
      "Obtener y negar información para tomar decisiones sobre rutas, rivales y objetivos. Un ward es útil cuando responde una pregunta de tu siguiente jugada.",
    when:
      "Antes de extender una línea, entrar a la jungla o preparar un objetivo que tu equipo puede disputar.",
    steps: [
      "Decide qué necesitas detectar y por qué entrada podría aparecer.",
      "Coloca visión con una ruta de retirada y apoyo cuando la zona sea peligrosa.",
      "Usa la información: si ves al rival en otro lado, adapta tu presión; si no lo ves, evita asumir que la zona está vacía.",
    ],
    pitfalls: [
      "Colocar wards por cantidad sin mirar si cubren tu próxima acción.",
      "Entrar solo a una zona oscura porque necesitas poner visión.",
    ],
    exercise:
      "En tres colocaciones, escribe qué querías detectar y si esa información cambió una decisión.",
    check: "¿El ward respondió una pregunta útil mientras estuvo disponible?",
    related: ["gankeo", "mid-game", "tempo"],
    resources: [wards, core],
  },
  {
    slug: "tempo",
    title: "Tempo",
    aliases: [
      "tempo",
      "prioridad de línea",
      "prioridad de linea",
      "rotación",
      "rotaciones",
      "roaming",
    ],
    category: "Jungla y mapa",
    definition:
      "Una ventana relativa en la que puedes actuar antes que un rival por la situación de oleadas, compras, desplazamientos o recursos.",
    when:
      "Al decidir si puedes salir de línea, invadir con apoyo, comprar o llegar a preparar un objetivo.",
    steps: [
      "Identifica qué obliga al rival a quedarse o retrasarse.",
      "Comprueba cuánto dura la ventana y el coste de tu desplazamiento.",
      "Haz una acción que puedas terminar a tiempo; tener prioridad no obliga a pelear.",
    ],
    pitfalls: [
      "Salir antes de resolver tu oleada y regalar más de lo que ganas.",
      "Continuar una jugada cuando la ventana ya terminó.",
    ],
    exercise:
      "Elige una rotación y compara lo que ganaste con los súbditos y el tiempo que cediste.",
    check:
      "¿Tu acción terminó antes de que el rival pudiera responder en igualdad?",
    related: ["control-de-oleadas", "mid-game", "compras"],
    resources: [wave, wards, core],
  },
  {
    slug: "posicionamiento",
    title: "Posicionamiento",
    aliases: ["posicionamiento", "positioning", "peel", "front to back"],
    category: "Mecánicas",
    definition:
      "Elegir tu ubicación respecto a aliados, rivales, terreno y rutas de salida para cumplir tu función con un riesgo razonable.",
    when:
      "Antes y durante un intercambio o pelea. La posición correcta para iniciar no es necesariamente la de un campeón que necesita protegerse y hacer daño sostenido.",
    steps: [
      "Identifica la habilidad o campeón que más amenaza tu función.",
      "Usa tu alcance, aliados y terreno para limitar esa amenaza.",
      "Reajusta cuando cambie la pelea en lugar de seguir al mismo objetivo automáticamente.",
    ],
    pitfalls: [
      "Acercarte al objetivo más valioso aunque no puedas alcanzarlo de forma segura.",
      "Retroceder hacia una zona sin salida o alejarte de tus aliados que pueden ayudarte.",
    ],
    exercise:
      "Pausa una pelea antes de entrar y dibuja dos posiciones posibles. Explica qué amenaza cubre cada una.",
    check:
      "¿Desde tu posición pudiste aportar y reaccionar a la amenaza principal?",
    related: ["kiteo", "vision", "late-game"],
    resources: [kite, attackMove, core],
  },
  {
    slug: "compras",
    title: "Compras e itemización",
    aliases: [
      "itemización",
      "itemizacion",
      "itemization",
      "compras",
      "build",
      "builds",
      "runas",
    ],
    category: "Preparación",
    definition:
      "Convertir tu oro y tus elecciones de preparación en herramientas que encajen con tu campeón, tu función y las amenazas de esa partida.",
    when:
      "En selección y en cada vuelta a base. Las compras se adaptan a los rivales que realmente te están amenazando y a tus próximos enfrentamientos.",
    steps: [
      "Reconoce si tu función necesita daño, supervivencia o utilidad para el equipo.",
      "Compara lo que puedes completar con tu oro actual y el beneficio de sus componentes.",
      "Reevalúa resistencias, penetración y herramientas defensivas según avance la partida; no copies seis objetos sin contexto.",
    ],
    pitfalls: [
      "Comprar resistencias contra el tipo de amenaza equivocado.",
      "Interpretar una guía general como la mejor build demostrada para cada enfrentamiento.",
    ],
    exercise:
      "En tu próxima compra, explica en una frase qué problema resuelve el objeto y qué alternativa descartaste.",
    check:
      "¿La compra ayudó en la siguiente situación para la que la elegiste?",
    related: ["tempo", "posicionamiento"],
    resources: [itemization, practice],
  },
];
const LEGACY_IDS: Record<string, string> = {
  kiteo: "kiting",
  "control-de-oleadas": "wave-management",
  gankeo: "gank",
};
export const ACADEMY = LESSONS.map((lesson) => {
  const slug = LEGACY_IDS[lesson.slug] ?? lesson.slug;
  const term = ACADEMY_TERMS.find((entry) => entry.id === slug);
  return {
    ...lesson,
    slug,
    title: term?.term ??
      (slug === "posicionamiento"
        ? "Positioning · posicionamiento"
        : slug === "compras"
        ? "Itemization · compras"
        : lesson.title),
    aliases: [
      ...new Set([
        ...(term ? [term.term, ...term.aliases] : []),
        ...lesson.aliases,
      ]),
    ],
    related: lesson.related.map((id) => LEGACY_IDS[id] ?? id),
  };
});
const PATCH_DEFINITIONS: Record<string, string> = {
  drake:
    "Objetivo neutral de la Grieta asociado a mejoras para el equipo y al sistema de Almas. Sus variantes, recompensas y condiciones dependen del modo y del parche.",
  baron:
    "Objetivo neutral asociado a una mejora para presionar estructuras. Consulta su disponibilidad y efectos actuales antes de planearlo.",
  herald:
    "Objetivo neutral que puede ayudar a presionar estructuras. Su presencia y reglas cambian entre temporadas y modos.",
  voidgrubs:
    "Campamento de objetivos conocido como larvas del Vacío, asociado a presión sobre estructuras. Comprueba si está disponible en tu modo y parche.",
  "tower-plates":
    "Placas de torre que pueden recompensar la presión sobre estructuras durante una ventana de la partida. La duración, disponibilidad y recompensas dependen del parche.",
};
export const ACADEMY_GLOSSARY = ACADEMY_TERMS.map((term) => ({
  ...term,
  definition: PATCH_DEFINITIONS[term.id] ?? term.definition,
}));
export const GLOSSARY_CATEGORIES: Record<string, string> = {
  farming: "Farmeo y oleadas",
  vision: "Visión",
  early_game: "Línea y juego temprano",
  objectives: "Objetivos y mapa",
  consistency: "Consistencia y peleas",
  general: "Fases y vocabulario",
};
export function relatedLessons(category: string) {
  const ids: Record<string, string[]> = {
    farming: ["wave-management", "freeze", "tempo"],
    vision: ["vision", "gank"],
    early_game: ["early-game", "gank", "wave-management"],
    objectives: ["mid-game", "vision", "tempo"],
    consistency: ["posicionamiento", "kiting", "late-game"],
    general: ["early-game", "mid-game", "late-game"],
  };
  return ACADEMY.filter((lesson) =>
    (ids[category] ?? ids.general).includes(lesson.slug)
  );
}
export function academyArticle(slug: string) {
  return ACADEMY.find((article) => article.slug === slug);
}
