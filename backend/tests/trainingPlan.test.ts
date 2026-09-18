import "./test_setup.ts";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";
import { eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../src/db/client.ts";
import {
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

Deno.test("generateTrainingPlan arma ítems a partir de las debilidades y usa la explicación inyectada", async () => {
  const riotAccountId = await createTestRiotAccount();
  await insertWeakness(riotAccountId, "farming", "high");
  await insertWeakness(riotAccountId, "vision", "medium");

  const explain = (_prompt: string) => Promise.resolve("Explicación de Gemini simulada.");

  const result = await generateTrainingPlan(riotAccountId, explain);

  assertExists(result.plan);
  assertEquals((result.plan as { generatedBy: string }).generatedBy, "llm");
  assertEquals(result.items.length >= 4, true);
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

Deno.test("generateTrainingPlan devuelve plan null sin debilidades ni campeones destacados", async () => {
  const riotAccountId = await createTestRiotAccount();
  const explain = (_prompt: string) => Promise.resolve("no debería llamarse");

  const result = await generateTrainingPlan(riotAccountId, explain);

  assertEquals(result.plan, null);
  assertEquals(result.items, []);
  assertExists(result.message);
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
