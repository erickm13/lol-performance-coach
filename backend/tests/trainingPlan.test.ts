import "./test_setup.ts";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";
import { eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../src/db/client.ts";
import {
  matches,
  matchParticipants,
  riotAccounts,
  trainingPlanItems,
  trainingPlans,
  users,
  weaknesses,
} from "../src/db/schema.ts";
import { GeminiError } from "../src/analysis/gemini.ts";
import {
  generateTrainingPlan,
  getCurrentTrainingPlan,
  markItemProgress,
} from "../src/analysis/trainingPlan.ts";

async function createTestRiotAccount(): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  const [riotAccount] = await db
    .insert(riotAccounts)
    .values({
      userId: user.id,
      puuid: crypto.randomUUID(),
      summonerName: "Tester",
      tagLine: "0000",
      region: "LAN",
    })
    .returning();
  return riotAccount.id;
}

async function insertWeakness(
  riotAccountId: string,
  category: string,
  severity: "low" | "medium" | "high",
): Promise<void> {
  await db.insert(weaknesses).values({
    riotAccountId,
    category,
    description: `Descripción de prueba para ${category}`,
    severity,
    evidence: [],
  });
}

async function createChampionMatch(
  riotAccountId: string,
  champion: string,
  win: boolean,
): Promise<void> {
  const [match] = await db
    .insert(matches)
    .values({
      riotMatchId: `LA1_${crypto.randomUUID()}`,
      gameCreation: new Date(),
      gameDurationSeconds: 1500,
    })
    .returning();

  await db.insert(matchParticipants).values({
    matchId: match.id,
    riotAccountId,
    puuid: crypto.randomUUID(),
    champion,
    teamId: 100,
    win,
    kills: 5,
    deaths: 5,
    assists: 5,
    csTotal: 150,
    visionScore: 20,
    goldTotal: 12000,
    damageTotal: 18000,
  });
}

Deno.test("generateTrainingPlan arma ítems a partir de las debilidades y usa la explicación inyectada", async () => {
  const riotAccountId = await createTestRiotAccount();
  await insertWeakness(riotAccountId, "farming", "high");
  await insertWeakness(riotAccountId, "vision", "medium");

  const explain = (_prompt: string) => Promise.resolve("Explicación de Gemini simulada.");

  const result = await generateTrainingPlan(riotAccountId, explain);

  assertExists(result.plan);
  assertEquals((result.plan as { generatedBy: string }).generatedBy, "llm");
  assertEquals(result.items.length, 4);
  assertEquals(
    (result.items[0] as { llmExplanation: string }).llmExplanation,
    "Explicación de Gemini simulada.",
  );
});

Deno.test("generateTrainingPlan cae a modo solo-reglas si Gemini falla", async () => {
  const riotAccountId = await createTestRiotAccount();
  await insertWeakness(riotAccountId, "farming", "high");

  const explain = (_prompt: string) => Promise.reject(new GeminiError("falló"));

  const result = await generateTrainingPlan(riotAccountId, explain);

  assertEquals((result.plan as { generatedBy: string }).generatedBy, "rules");
  const first = result.items[0] as { llmExplanation: string; description: string };
  assertEquals(first.llmExplanation, first.description);
});

Deno.test("generateTrainingPlan descarta explicaciones exitosas previas si Gemini falla más tarde en el mismo plan", async () => {
  const riotAccountId = await createTestRiotAccount();
  await insertWeakness(riotAccountId, "farming", "high");
  await insertWeakness(riotAccountId, "vision", "medium");

  let callCount = 0;
  const explain = (_prompt: string) => {
    callCount++;
    if (callCount <= 2) {
      return Promise.resolve(`Éxito de Gemini #${callCount}`);
    }
    return Promise.reject(new GeminiError("falla tardía"));
  };

  const result = await generateTrainingPlan(riotAccountId, explain);

  assertEquals(callCount >= 3, true);
  assertEquals((result.plan as { generatedBy: string }).generatedBy, "rules");
  assertEquals(result.items.length, 4);
  for (const item of result.items) {
    const typed = item as { llmExplanation: string; description: string };
    assertEquals(typed.llmExplanation, typed.description);
  }
});

Deno.test("generateTrainingPlan no duplica el plan si ya hay uno activo esta semana", async () => {
  const riotAccountId = await createTestRiotAccount();
  await insertWeakness(riotAccountId, "farming", "high");
  const explain = (_prompt: string) => Promise.resolve("Explicación.");

  const first = await generateTrainingPlan(riotAccountId, explain);
  const second = await generateTrainingPlan(riotAccountId, explain);

  assertEquals((first.plan as { id: string }).id, (second.plan as { id: string }).id);

  const allPlans = await db
    .select()
    .from(trainingPlans)
    .where(eq(trainingPlans.riotAccountId, riotAccountId));
  assertEquals(allPlans.length, 1);
});

Deno.test("generateTrainingPlan usa como máximo 3 debilidades, priorizando por severidad", async () => {
  const riotAccountId = await createTestRiotAccount();
  await insertWeakness(riotAccountId, "farming", "high");
  await insertWeakness(riotAccountId, "vision", "high");
  await insertWeakness(riotAccountId, "objectives", "medium");
  await insertWeakness(riotAccountId, "early_game", "low");
  const explain = (_prompt: string) => Promise.resolve("Explicación.");

  const result = await generateTrainingPlan(riotAccountId, explain);

  // 3 debilidades seleccionadas (las 2 "high" + la "medium"), 2 ítems cada una.
  assertEquals(result.items.length, 6);

  const titles = result.items.map((i) => (i as { title: string }).title);
  assertEquals(titles.some((t) => t.includes("early_game")), false);
  assertEquals(titles.some((t) => t.includes("farming")), true);
  assertEquals(titles.some((t) => t.includes("vision")), true);
  assertEquals(titles.some((t) => t.includes("objectives")), true);

  // La debilidad "medium" (objectives) va después de las dos "high" (farming/vision),
  // que ocupan los primeros 4 ítems (2 debilidades x 2 ítems cada una).
  const objectivesIndex = titles.findIndex((t) => t.includes("objectives"));
  assertEquals(objectivesIndex >= 4, true);
});

Deno.test("generateTrainingPlan genera como máximo 1 ítem champion_avoid y 1 champion_priority aunque haya varios candidatos", async () => {
  const riotAccountId = await createTestRiotAccount();

  // Candidatos a evitar (winRate < 45%, >= 3 partidas): ChampA es el peor.
  await createChampionMatch(riotAccountId, "ChampA", false);
  await createChampionMatch(riotAccountId, "ChampA", false);
  await createChampionMatch(riotAccountId, "ChampA", false);
  await createChampionMatch(riotAccountId, "ChampB", true);
  await createChampionMatch(riotAccountId, "ChampB", false);
  await createChampionMatch(riotAccountId, "ChampB", false);
  await createChampionMatch(riotAccountId, "ChampB", false);

  // Candidatos a priorizar (winRate >= 55%, >= 3 partidas): ChampC es el mejor.
  await createChampionMatch(riotAccountId, "ChampC", true);
  await createChampionMatch(riotAccountId, "ChampC", true);
  await createChampionMatch(riotAccountId, "ChampC", true);
  await createChampionMatch(riotAccountId, "ChampD", true);
  await createChampionMatch(riotAccountId, "ChampD", true);
  await createChampionMatch(riotAccountId, "ChampD", true);
  await createChampionMatch(riotAccountId, "ChampD", false);

  const explain = (_prompt: string) => Promise.resolve("Explicación.");

  const result = await generateTrainingPlan(riotAccountId, explain);

  const avoidItems = result.items.filter((i) => (i as { type: string }).type === "champion_avoid");
  const priorityItems = result.items.filter((i) =>
    (i as { type: string }).type === "champion_priority"
  );

  assertEquals(avoidItems.length, 1);
  assertEquals(priorityItems.length, 1);
  assertEquals((avoidItems[0] as { title: string }).title, "Evitar ChampA por ahora");
  assertEquals((priorityItems[0] as { title: string }).title, "Priorizar ChampC");
  assertEquals(result.items.length, 2);
});

Deno.test("generateTrainingPlan devuelve plan null sin debilidades ni campeones destacados", async () => {
  const riotAccountId = await createTestRiotAccount();
  const explain = (_prompt: string) => Promise.resolve("no debería llamarse");

  const result = await generateTrainingPlan(riotAccountId, explain);

  assertEquals(result.plan, null);
  assertEquals(result.items, []);
  assertExists(result.message);

  const storedPlans = await db
    .select()
    .from(trainingPlans)
    .where(eq(trainingPlans.riotAccountId, riotAccountId));
  assertEquals(storedPlans.length, 0);
});

Deno.test("getCurrentTrainingPlan devuelve plan null si no hay plan activo", async () => {
  const riotAccountId = await createTestRiotAccount();
  const result = await getCurrentTrainingPlan(riotAccountId);
  assertEquals(result.plan, null);
  assertEquals(result.items, []);
});

Deno.test("getCurrentTrainingPlan devuelve el plan generado y sus ítems", async () => {
  const riotAccountId = await createTestRiotAccount();
  await insertWeakness(riotAccountId, "vision", "low");
  const explain = (_prompt: string) => Promise.resolve("Explicación.");
  await generateTrainingPlan(riotAccountId, explain);

  const result = await getCurrentTrainingPlan(riotAccountId);
  assertExists(result.plan);
  assertEquals(result.items.length > 0, true);
});

Deno.test("getCurrentTrainingPlan marca completed=true solo en los ítems con progreso guardado", async () => {
  const riotAccountId = await createTestRiotAccount();
  await insertWeakness(riotAccountId, "vision", "low");
  const explain = (_prompt: string) => Promise.resolve("Explicación.");
  const generated = await generateTrainingPlan(riotAccountId, explain);
  const itemIds = (generated.items as { id: string }[]).map((item) => item.id);

  await markItemProgress(itemIds[0], {});

  const result = await getCurrentTrainingPlan(riotAccountId);
  const items = result.items as { id: string; completed: boolean }[];
  assertEquals(items.find((item) => item.id === itemIds[0])?.completed, true);
  for (const item of items.slice(1)) {
    assertEquals(item.completed, false);
  }
});

Deno.test("markItemProgress inserta un registro de progreso", async () => {
  const riotAccountId = await createTestRiotAccount();
  await insertWeakness(riotAccountId, "vision", "low");
  const explain = (_prompt: string) => Promise.resolve("Explicación.");
  const { items } = await generateTrainingPlan(riotAccountId, explain);
  const itemId = (items[0] as { id: string }).id;

  const progress = await markItemProgress(itemId, { selfRating: 4, note: "Bien" });
  assertEquals((progress as { selfRating: number }).selfRating, 4);
  assertEquals((progress as { note: string }).note, "Bien");

  const stored = await db
    .select()
    .from(trainingPlanItems)
    .where(eq(trainingPlanItems.id, itemId));
  assertEquals(stored.length, 1);
});
