import "./test_setup.ts";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";
import { db } from "../src/db/client.ts";
import { matches, matchMetrics, matchParticipants, riotAccounts, users } from "../src/db/schema.ts";
import { signSessionToken } from "../src/auth/jwt.ts";
import { app } from "../src/app.ts";

async function createUserWithRiotAccount(): Promise<{ cookie: string; riotAccountId: string }> {
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
  const token = await signSessionToken(user.id);
  return { cookie: `session=${token}`, riotAccountId: riotAccount.id };
}

async function createFullMatch(
  riotAccountId: string,
  opts: { win: boolean; champion?: string; queueId?: number; gameCreation?: Date } = { win: true },
): Promise<string> {
  const [match] = await db
    .insert(matches)
    .values({
      riotMatchId: `LA1_${crypto.randomUUID()}`,
      queueId: opts.queueId ?? 420,
      gameCreation: opts.gameCreation ?? new Date(),
      gameDurationSeconds: 1600,
    })
    .returning();

  const [own] = await db
    .insert(matchParticipants)
    .values({
      matchId: match.id,
      riotAccountId,
      puuid: crypto.randomUUID(),
      champion: opts.champion ?? "Zed",
      teamId: 100,
      win: opts.win,
      kills: 10,
      deaths: 3,
      assists: 5,
      csTotal: 180,
      visionScore: 22,
      goldTotal: 13000,
      damageTotal: 21000,
    })
    .returning();

  await db.insert(matchMetrics).values({
    matchParticipantId: own.id,
    csPerMin: 6.75,
    kda: 5,
    visionScorePerMin: 0.82,
    goldPerMin: 487,
    damagePerMin: 787,
    killParticipation: 0.6,
  });

  // Resto del roster: 4 más en el equipo azul, 5 en el rojo.
  const others = [
    ...Array.from({ length: 4 }, () => 100),
    ...Array.from({ length: 5 }, () => 200),
  ];
  await db.insert(matchParticipants).values(
    others.map((teamId, i) => ({
      matchId: match.id,
      riotAccountId: null,
      puuid: crypto.randomUUID(),
      champion: `Campeon${i}`,
      teamId,
      win: teamId === 100 ? opts.win : !opts.win,
      kills: i,
      deaths: i,
      assists: i,
      csTotal: 100,
      visionScore: 10,
      goldTotal: 9000,
      damageTotal: 10000,
    })),
  );

  return match.id;
}

Deno.test("GET /riot/matches rechaza a un usuario no autenticado", async () => {
  const res = await app.request("/riot/matches");
  assertEquals(res.status, 401);
});

Deno.test("GET /riot/matches devuelve lista vacía sin cuenta vinculada", async () => {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  const token = await signSessionToken(user.id);

  const res = await app.request("/riot/matches", {
    headers: { Cookie: `session=${token}` },
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.matches, []);
  assertEquals(body.total, 0);
});

Deno.test("GET /riot/matches devuelve las partidas de la cuenta, más recientes primero", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  await createFullMatch(riotAccountId, { win: true, gameCreation: new Date("2026-01-01") });
  await createFullMatch(riotAccountId, { win: false, gameCreation: new Date("2026-01-05") });

  const res = await app.request("/riot/matches", { headers: { Cookie: cookie } });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.total, 2);
  assertEquals(body.matches.length, 2);
  assertEquals(body.matches[0].win, false); // la más reciente (5 de enero)
  assertEquals(body.matches[1].win, true);
});

Deno.test("GET /riot/matches filtra por resultado", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  await createFullMatch(riotAccountId, { win: true });
  await createFullMatch(riotAccountId, { win: false });

  const res = await app.request("/riot/matches?result=win", { headers: { Cookie: cookie } });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.total, 1);
  assertEquals(body.matches[0].win, true);
});

Deno.test("GET /riot/matches/:matchId rechaza a un usuario no autenticado", async () => {
  const res = await app.request(`/riot/matches/${crypto.randomUUID()}`);
  assertEquals(res.status, 401);
});

Deno.test("GET /riot/matches/:matchId devuelve 404 con un id mal formado", async () => {
  const { cookie } = await createUserWithRiotAccount();
  const res = await app.request("/riot/matches/no-es-un-uuid", { headers: { Cookie: cookie } });
  assertEquals(res.status, 404);
});

Deno.test("GET /riot/matches/:matchId devuelve 404 con un UUID inexistente", async () => {
  const { cookie } = await createUserWithRiotAccount();
  const res = await app.request(`/riot/matches/${crypto.randomUUID()}`, {
    headers: { Cookie: cookie },
  });
  assertEquals(res.status, 404);
});

Deno.test("GET /riot/matches/:matchId devuelve 404 si la partida pertenece a otra cuenta", async () => {
  const { riotAccountId: ownerAccountId } = await createUserWithRiotAccount();
  const { cookie: otherCookie } = await createUserWithRiotAccount();
  const matchId = await createFullMatch(ownerAccountId, { win: true });

  const res = await app.request(`/riot/matches/${matchId}`, { headers: { Cookie: otherCookie } });
  assertEquals(res.status, 404);
});

Deno.test("GET /riot/matches/:matchId devuelve la partida propia con ambos equipos", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  const matchId = await createFullMatch(riotAccountId, { win: true, champion: "Ahri" });

  const res = await app.request(`/riot/matches/${matchId}`, { headers: { Cookie: cookie } });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.match);
  assertEquals(body.own.champion, "Ahri");
  assertExists(body.own.metrics);
  assertEquals(body.teams.blue.length, 5); // la propia + 4 compañeros
  assertEquals(body.teams.red.length, 5);
});
