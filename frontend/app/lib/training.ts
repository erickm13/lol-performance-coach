export type PlanItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  llmExplanation: string | null;
  completed: boolean;
};
export type PlanData = {
  plan:
    | { id: string; weekStart: string; weekEnd: string; generatedBy: string }
    | null;
  items: PlanItem[];
  message?: string;
};
export type Weakness = {
  id: string;
  category: string;
  severity: string;
  description: string;
  detectedAt?: string;
  evidenceMatches?: {
    participantId: string;
    matchId: string;
    champion: string;
    win: boolean;
    playedAt: string;
  }[];
};
export type WeaknessData = {
  weaknesses: Weakness[];
  linked?: boolean;
  sample?: { count: number; required: number };
  analysis?: { version: string; note: string; references: Record<string, { label: string; cs: number | null; vision: number; participation: number }> };
};
export const CATEGORIES: Record<string, string> = {
  farming: "Farmeo",
  vision: "Visión",
  early_game: "Juego temprano",
  consistency: "Consistencia",
  objectives: "Participación en equipo",
};
export const SEVERITIES: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};
export const GOALS: Record<string, string> = {
  farming: "Perder menos oleadas y mejorar tu CS por minuto.",
  vision: "Crear el hábito de preparar visión antes de avanzar.",
  early_game: "Reducir tus muertes durante los primeros diez minutos.",
  consistency: "Identificar decisiones repetidas en tus partidas difíciles.",
  objectives: "Preparar tus peleas por objetivos junto a tu equipo.",
};
export function itemCategory(item: PlanItem) {
  const category = item.title.split(":").at(-1)?.trim() ?? "";
  return CATEGORIES[category] ? category : "other";
}
export function itemTitle(item: PlanItem) {
  const category = itemCategory(item);
  if (category === "other") return item.title;
  return `${item.type === "drill" ? "Practicar" : "Trabajar"}: ${
    CATEGORIES[category]
  }`;
}
// Present older saved plans consistently without rewriting their original data.
export function trainingCopy(value: string) {
  return value.replace(/Jugá(?=\s|[.,!?]|$)/g, "Juega").replace(
    /Comprá(?=\s|[.,!?]|$)/g,
    "Compra",
  )
    .replace(/Repasá(?=\s|[.,!?]|$)/g, "Repasa").replace(
      /anotá(?=\s|[.,!?]|$)/g,
      "anota",
    )
    .replace(/esperá(?=\s|[.,!?]|$)/g, "espera").replace(
      /evitá(?=\s|[.,!?]|$)/g,
      "evita",
    );
}
