import "./test_setup.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../src/db/client.ts";
import {
  matches,
  matchMetrics,
  matchParticipants,
  riotAccounts,
  users,
  weaknesses,
} from "../src/db/schema.ts";
import { detectWeaknesses, MatchStatRow, saveWeaknesses } from "../src/analysis/weaknesses.ts";

function rowsAllGood(count: number): MatchStatRow[] {
  return Array.from({ length: count }, (_, i) => ({
    matchParticipantId: `mp-${i}`,
    csPerMin: 8,
    visionScorePerMin: 1.2,
    kda: 4,
    killParticipation: 0.65,
    deathsBefore10: 0,
  }));
}

Deno.test("detectWeaknesses no dispara ninguna regla con buenas métricas", () => {
  const result = detectWeaknesses(rowsAllGood(10));
  assertEquals(result, []);
});

Deno.test("detectWeaknesses dispara farming con CS/min bajo y calcula la severidad", () => {
  const rows = rowsAllGood(10).map((r) => ({ ...r, csPerMin: 3.5 }));
  const result = detectWeaknesses(rows);
  const farming = result.find((w) => w.category === "farming");
  assertEquals(farming?.severity, "high");
  assertEquals(farming?.evidence.length, 3);
});

Deno.test("detectWeaknesses dispara vision con severidad media", () => {
  const rows = rowsAllGood(10).map((r) => ({ ...r, visionScorePerMin: 0.5 }));
  const result = detectWeaknesses(rows);
  const vision = result.find((w) => w.category === "vision");
  assertEquals(vision?.severity, "medium");
});

Deno.test("detectWeaknesses dispara consistency con KDA muy variable", () => {
  const rows = rowsAllGood(10).map((r, i) => ({
    ...r,
    kda: i % 2 === 0 ? 8 : 0.5,
  }));
  const result = detectWeaknesses(rows);
  assertEquals(result.some((w) => w.category === "consistency"), true);
});

Deno.test("detectWeaknesses dispara objectives con kill participation bajo", () => {
  const rows = rowsAllGood(10).map((r) => ({ ...r, killParticipation: 0.2 }));
  const result = detectWeaknesses(rows);
  const objectives = result.find((w) => w.category === "objectives");
  assertEquals(objectives?.severity, "high");
});

Deno.test("detectWeaknesses dispara early_game con muchas muertes antes del min 10", () => {
  const rows = rowsAllGood(10).map((r) => ({ ...r, deathsBefore10: 3 }));
  const result = detectWeaknesses(rows);
  const early = result.find((w) => w.category === "early_game");
  assertEquals(early?.severity, "high");
});

Deno.test("detectWeaknesses ignora deathsBefore10 null al promediar", () => {
  const rows = rowsAllGood(10).map((r) => ({ ...r, deathsBefore10: null }));
  const result = detectWeaknesses(rows);
  assertEquals(result.some((w) => w.category === "early_game"), false);
});

async function createTestRiotAccountWithRows(
  rows: Omit<MatchStatRow, "matchParticipantId">[],
): Promise<string> {
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

  for (const row of rows) {
    const [match] = await db
      .insert(matches)
      .values({
        riotMatchId: `LA1_${crypto.randomUUID()}`,
        gameCreation: new Date(),
        gameDurationSeconds: 1500,
      })
      .returning();
    const [participant] = await db
      .insert(matchParticipants)
      .values({
        matchId: match.id,
        riotAccountId: riotAccount.id,
        puuid: crypto.randomUUID(),
        champion: "Zed",
        teamId: 100,
        win: true,
        kills: 5,
        deaths: 3,
        assists: 5,
        csTotal: 150,
        visionScore: 20,
        goldTotal: 12000,
        damageTotal: 18000,
      })
      .returning();
    await db.insert(matchMetrics).values({
      matchParticipantId: participant.id,
      csPerMin: row.csPerMin,
      kda: row.kda,
      visionScorePerMin: row.visionScorePerMin,
      deathsBefore10: row.deathsBefore10,
      goldPerMin: 480,
      damagePerMin: 720,
      killParticipation: row.killParticipation,
    });
  }

  return riotAccount.id;
}

Deno.test("saveWeaknesses no hace nada con menos de 10 partidas guardadas", async () => {
  const riotAccountId = await createTestRiotAccountWithRows(
    rowsAllGood(5).map(({ matchParticipantId: _drop, ...rest }) => rest),
  );
  const result = await saveWeaknesses(riotAccountId);
  assertEquals(result, []);

  const stored = await db
    .select()
    .from(weaknesses)
    .where(eq(weaknesses.riotAccountId, riotAccountId));
  assertEquals(stored.length, 0);
});

Deno.test("saveWeaknesses guarda las debilidades detectadas y reemplaza las anteriores", async () => {
  const badRows = rowsAllGood(10).map(({ matchParticipantId: _drop, ...rest }) => ({
    ...rest,
    csPerMin: 3,
  }));
  const riotAccountId = await createTestRiotAccountWithRows(badRows);

  const first = await saveWeaknesses(riotAccountId);
  assertEquals(first.some((w) => w.category === "farming"), true);

  const stored = await db
    .select()
    .from(weaknesses)
    .where(eq(weaknesses.riotAccountId, riotAccountId));
  assertEquals(stored.length, first.length);

  const second = await saveWeaknesses(riotAccountId);
  const storedAfterSecond = await db
    .select()
    .from(weaknesses)
    .where(eq(weaknesses.riotAccountId, riotAccountId));
  assertEquals(storedAfterSecond.length, second.length);
});
