import "./test_setup.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { db } from "../src/db/client.ts";
import {
  matches,
  matchMetrics,
  matchParticipants,
  matchTeammates,
  riotAccounts,
  users,
} from "../src/db/schema.ts";
import { getChampionStats, getRecentTeammates } from "../src/riot/ingest.ts";

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

async function createTestMatchParticipant(
  riotAccountId: string,
  champion: string,
  win: boolean,
  kda: { kills: number; deaths: number; assists: number },
): Promise<string> {
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
      riotAccountId,
      puuid: crypto.randomUUID(),
      champion,
      teamId: 100,
      win,
      kills: kda.kills,
      deaths: kda.deaths,
      assists: kda.assists,
      csTotal: 150,
      visionScore: 20,
      goldTotal: 12000,
      damageTotal: 18000,
    })
    .returning();

  await db.insert(matchMetrics).values({
    matchParticipantId: participant.id,
    csPerMin: 6,
    kda: (kda.kills + kda.assists) / Math.max(kda.deaths, 1),
    visionScorePerMin: 0.8,
    goldPerMin: 480,
    damagePerMin: 720,
    killParticipation: 0.6,
  });

  return participant.id;
}

Deno.test("getChampionStats agrupa las partidas por campeón con winrate y KDA promedio", async () => {
  const riotAccountId = await createTestRiotAccount();

  await createTestMatchParticipant(riotAccountId, "Zed", true, {
    kills: 10,
    deaths: 2,
    assists: 4,
  });
  await createTestMatchParticipant(riotAccountId, "Zed", false, {
    kills: 4,
    deaths: 6,
    assists: 2,
  });
  await createTestMatchParticipant(riotAccountId, "Ahri", true, {
    kills: 8,
    deaths: 1,
    assists: 10,
  });

  const stats = await getChampionStats(riotAccountId);

  assertEquals(stats.length, 2);

  const zed = stats.find((s) => s.champion === "Zed");
  assertEquals(zed?.games, 2);
  assertEquals(zed?.winRate, 50);
  assertEquals(zed?.avgKills, 7);

  const ahri = stats.find((s) => s.champion === "Ahri");
  assertEquals(ahri?.games, 1);
  assertEquals(ahri?.winRate, 100);
});

Deno.test("getChampionStats ordena los campeones por partidas jugadas descendente", async () => {
  const riotAccountId = await createTestRiotAccount();

  await createTestMatchParticipant(riotAccountId, "Yasuo", true, {
    kills: 5,
    deaths: 3,
    assists: 5,
  });
  await createTestMatchParticipant(riotAccountId, "Jinx", true, {
    kills: 6,
    deaths: 2,
    assists: 6,
  });
  await createTestMatchParticipant(riotAccountId, "Jinx", true, {
    kills: 7,
    deaths: 1,
    assists: 7,
  });

  const stats = await getChampionStats(riotAccountId);

  assertEquals(stats[0].champion, "Jinx");
  assertEquals(stats[0].games, 2);
});

Deno.test("getRecentTeammates cuenta partidas jugadas juntos y el winrate compartido", async () => {
  const riotAccountId = await createTestRiotAccount();
  const teammatePuuid = crypto.randomUUID();

  const p1 = await createTestMatchParticipant(riotAccountId, "Zed", true, {
    kills: 10,
    deaths: 2,
    assists: 4,
  });
  const p2 = await createTestMatchParticipant(riotAccountId, "Zed", false, {
    kills: 4,
    deaths: 6,
    assists: 2,
  });

  await db.insert(matchTeammates).values([
    {
      matchParticipantId: p1,
      puuid: teammatePuuid,
      summonerName: "jeangelos",
      win: true,
    },
    {
      matchParticipantId: p2,
      puuid: teammatePuuid,
      summonerName: "jeangelos",
      win: false,
    },
  ]);

  const teammates = await getRecentTeammates(riotAccountId);

  assertEquals(teammates.length, 1);
  assertEquals(teammates[0].summonerName, "jeangelos");
  assertEquals(teammates[0].games, 2);
  assertEquals(teammates[0].winRate, 50);
});

Deno.test("getRecentTeammates devuelve una lista vacía sin partidas guardadas", async () => {
  const riotAccountId = await createTestRiotAccount();
  const teammates = await getRecentTeammates(riotAccountId);
  assertEquals(teammates, []);
});
