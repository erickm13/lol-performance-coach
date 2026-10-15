import { and, eq, inArray, sql } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import {
  planProgress,
  trainingPlanItems,
  trainingPlans,
  weaknesses as weaknessesTable,
} from "../db/schema.ts";
import { getChampionStats } from "../riot/ingest.ts";
import { generateExplanation, GroqError } from "./groq.ts";

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const DRILL_BY_CATEGORY: Record<string, string> = {
  farming:
    "Juega 2 partidas normales priorizando no perder oleadas de creeps hasta el minuto 15.",
  vision:
    "Compra un control ward cada vez que vuelvas a base durante 3 partidas normales.",
  consistency:
    "Repasa el replay de tu peor partida de la semana y anota en qué momento se te fue la partida.",
  objectives:
    "Antes de pelear por un objetivo, espera a estar agrupado con al menos 2 compañeros.",
  early_game:
    "Juega más defensivo en la línea hasta el minuto 10: evita trades sin ventaja clara.",
};

function currentWeekRange(
  now = new Date(),
): { weekStart: string; weekEnd: string } {
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { weekStart: toIso(monday), weekEnd: toIso(sunday) };
}

type PlanItemDraft = {
  type: string;
  title: string;
  description: string;
  evidenceMetricRefs: string[];
};

export type TrainingPlanItemWithProgress =
  & typeof trainingPlanItems.$inferSelect
  & {
    completed: boolean;
  };

/**
 * Shape único que devuelven tanto `generateTrainingPlan` como
 * `getCurrentTrainingPlan`, para que POST y GET /riot/training-plan respondan
 * igual (ítems siempre con `completed`, siempre ordenados por `position`).
 */
export type TrainingPlanResult = {
  plan: typeof trainingPlans.$inferSelect | null;
  items: TrainingPlanItemWithProgress[];
  message?: string;
};

export async function generateTrainingPlan(
  riotAccountId: string,
  explain: (prompt: string) => Promise<string> = generateExplanation,
): Promise<TrainingPlanResult> {
  const { weekStart, weekEnd } = currentWeekRange();

  const [existing] = await db
    .select()
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.riotAccountId, riotAccountId),
        eq(trainingPlans.status, "active"),
        eq(trainingPlans.weekStart, weekStart),
      ),
    )
    .limit(1);

  if (existing) {
    // Reusamos la lectura del GET para no duplicar lógica ni devolver ítems con
    // un shape distinto (sin `completed`) al del endpoint de consulta.
    return await getCurrentTrainingPlan(riotAccountId);
  }

  const currentWeaknesses = await db
    .select()
    .from(weaknessesTable)
    .where(eq(weaknessesTable.riotAccountId, riotAccountId))
    // Sin un ORDER BY explícito, cuáles 3 debilidades entran al plan cuando hay
    // empate de severidad quedaba a criterio de Postgres. Mismo CASE que usa
    // GET /riot/weaknesses.
    .orderBy(
      sql`case ${weaknessesTable.severity}
        when 'high' then 0
        when 'medium' then 1
        when 'low' then 2
        else 3
      end`,
      weaknessesTable.detectedAt,
    );

  const topWeaknesses = [...currentWeaknesses]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 3);

  const championStats = await getChampionStats(riotAccountId);
  const eligible = championStats.filter((c) => c.games >= 3);
  const avoidChampion = eligible
    .filter((c) => c.winRate < 45)
    .sort((a, b) => a.winRate - b.winRate)[0];
  const priorityChampion = eligible
    .filter((c) => c.winRate >= 55)
    .sort((a, b) => b.winRate - a.winRate)[0];

  const drafts: PlanItemDraft[] = [];

  for (const w of topWeaknesses) {
    drafts.push({
      type: "focus_area",
      title: `Trabajar: ${w.category}`,
      description: w.description,
      evidenceMetricRefs: (w.evidence as string[]) ?? [],
    });
    drafts.push({
      type: "drill",
      title: `Ejercicio: ${w.category}`,
      description: DRILL_BY_CATEGORY[w.category] ?? w.description,
      evidenceMetricRefs: (w.evidence as string[]) ?? [],
    });
  }

  if (avoidChampion) {
    drafts.push({
      type: "champion_avoid",
      title: `Evitar ${avoidChampion.champion} por ahora`,
      description:
        `Tu winrate con ${avoidChampion.champion} es ${avoidChampion.winRate}% en ${avoidChampion.games} partidas.`,
      evidenceMetricRefs: [],
    });
  }
  if (priorityChampion) {
    drafts.push({
      type: "champion_priority",
      title: `Priorizar ${priorityChampion.champion}`,
      description:
        `Tu winrate con ${priorityChampion.champion} es ${priorityChampion.winRate}% en ${priorityChampion.games} partidas.`,
      evidenceMetricRefs: [],
    });
  }

  if (drafts.length === 0) {
    return {
      plan: null,
      items: [],
      message: "No se detectaron patrones para mejorar esta semana.",
    };
  }

  let generatedBy: "llm" | "rules" = "llm";
  let explanations: string[] = [];
  try {
    explanations = [];
    for (const d of drafts) {
      const prompt =
        `Eres un coach de League of Legends. Con este dato: "${d.description}". ` +
        `Escribe 1-2 oraciones en español explicando este punto del plan de entrenamiento, ` +
        `citando el número exacto que te di. No inventes causas que no estén en el dato.`;
      explanations.push(await explain(prompt));
    }
  } catch (err) {
    if (!(err instanceof GroqError)) throw err;
    generatedBy = "rules";
    explanations = drafts.map((d) => d.description);
  }

  const [plan] = await db
    .insert(trainingPlans)
    .values({
      riotAccountId,
      weekStart,
      weekEnd,
      status: "active",
      generatedBy,
    })
    .returning();

  const inserted = await db
    .insert(trainingPlanItems)
    .values(
      // `position` (0-indexado) congela el orden de presentación: los pares
      // focus_area/drill ordenados por severidad, después champion_avoid y
      // champion_priority. `drafts` ya está en ese orden.
      drafts.map((d, i) => ({
        trainingPlanId: plan.id,
        position: i,
        type: d.type,
        title: d.title,
        description: d.description,
        llmExplanation: explanations[i],
        evidenceMetricRefs: d.evidenceMetricRefs,
      })),
    )
    .returning();

  // RETURNING no garantiza orden; lo imponemos igual que hace la lectura.
  // `completed` siempre arranca en false: el plan se acaba de crear.
  const items = [...inserted]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ ...item, completed: false }));

  return { plan, items };
}

export async function getCurrentTrainingPlan(
  riotAccountId: string,
): Promise<TrainingPlanResult> {
  const { weekStart } = currentWeekRange();
  const [plan] = await db
    .select()
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.riotAccountId, riotAccountId),
        eq(trainingPlans.status, "active"),
        eq(trainingPlans.weekStart, weekStart),
      ),
    )
    .limit(1);
  if (!plan) return { plan: null, items: [] };

  const items = await db
    .select()
    .from(trainingPlanItems)
    .where(eq(trainingPlanItems.trainingPlanId, plan.id))
    .orderBy(trainingPlanItems.position);

  const itemIds = items.map((item) => item.id);
  const progressRows = itemIds.length > 0
    ? await db
      .select({ trainingPlanItemId: planProgress.trainingPlanItemId })
      .from(planProgress)
      .where(inArray(planProgress.trainingPlanItemId, itemIds))
    : [];
  const completedItemIds = new Set(
    progressRows.map((row) => row.trainingPlanItemId),
  );
  const itemsWithProgress = items.map((item) => ({
    ...item,
    completed: completedItemIds.has(item.id),
  }));

  return { plan, items: itemsWithProgress };
}

export async function markItemProgress(
  itemId: string,
  data: { selfRating?: number; note?: string },
) {
  const [progress] = await db
    .insert(planProgress)
    .values({
      trainingPlanItemId: itemId,
      selfRating: data.selfRating ?? null,
      note: data.note ?? null,
    })
    .returning();
  return progress;
}
