# Weakness Detection and Training Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the already-existing (but empty) `weaknesses`/`training_plans`/`training_plan_items`/`plan_progress` tables into a real feature: a rules-based engine that detects recurring weaknesses from stored match data, and a weekly training plan generator whose explanations are written by Gemini (with a rules-only fallback), surfaced on two new dashboard pages.

**Architecture:** New `backend/src/analysis/` module with two independently-testable pieces — a pure rule engine (`weaknesses.ts`) and a plan generator (`trainingPlan.ts`) that reuses the existing `getChampionStats` export and calls a small injectable Gemini client (`gemini.ts`). Detection runs automatically and synchronously at the end of `linkRiotAccount`/`syncRiotAccount` (same synchronous-in-request pattern `ingestMatches` already uses — no queue). Plan generation is a separate, explicit, idempotent-per-week endpoint. Two new frontend pages read these via two new `/riot/weaknesses` and `/riot/training-plan` endpoints mounted from a new `backend/src/routes/training.ts`.

**Tech Stack:** Deno + Hono + Drizzle ORM (backend, unchanged), Next.js + Tailwind (frontend, unchanged), Google Generative Language API (Gemini) via plain `fetch`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-18-weakness-detection-and-training-plan-design.md`

## Global Constraints

- Backend imports: `jsr:@hono/hono@^4.6.0` (+ `/cookie`, `/jwt`), `npm:drizzle-orm@^0.36.0`, `jsr:@std/assert@^1.0.0` in tests — match exactly what every existing backend file already uses, do not introduce a different version.
- Backend tests import `./test_setup.ts` as the first line (runs migrations before the DB is touched) — every new backend test file needs this, copied verbatim from any existing test file.
- Running backend tests locally requires these env vars exported in the shell first (CI only sets `DATABASE_URL`/`JWT_SECRET` — see `.github/workflows/ci.yml` — so any test that needs `RIOT_API_KEY`/`GEMINI_API_KEY` must set them itself via `Deno.env.set(...)`, never assume the shell/CI provides them):
  ```
  DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5433/lol_analytics
  JWT_SECRET=<value from .env>
  RESEND_API_KEY=<value from .env>
  RIOT_API_KEY=<value from .env>
  FRONTEND_URL=http://localhost:3000
  ```
  (Real values live in the project's `.env`, gitignored — pull them from there, never hardcode a different value.)
- Docker Desktop + `docker compose up -d postgres` must be running before any backend test task — if `docker ps` fails with a pipe error, launch `C:\Users\mejia\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe` and poll `docker info` until it succeeds before retrying.
- Frontend: all new components are Tailwind + the existing `.rune-*` classes from `frontend/app/globals.css` (`rune-panel`, `rune-field`, `rune-btn`, `rune-link`) and the existing color tokens from `frontend/tailwind.config.ts` (`ink`, `panel`, `panel-line`, `mist`, `parchment`, `teal`/`teal-dim`, `gold`/`gold-dim`, `ember`). Never introduce a new color or a new custom CSS class.
- Every new frontend `fetch` call uses `getBackendUrl()` from `frontend/app/lib/api.ts` and `credentials: "include"`, matching every existing component.
- Run `deno task lint` (backend) and `npx next lint` + `npx tsc --noEmit -p tsconfig.json` (frontend) before every commit that touches those trees — the project has zero tolerance for lint/type errors in its history.

---

## Task 1: Riot match timeline client + deaths-before-10 extraction

**Files:**
- Modify: `backend/src/riot/client.ts`
- Test: `backend/tests/riot-timeline.test.ts` (create)

**Interfaces:**
- Produces: `getMatchTimeline(matchId: string, fetchFn?: typeof fetch): Promise<RiotMatchTimeline>`, `countDeathsBefore10(timeline: RiotMatchTimeline, participantId: number): number`, and adds `participantId: number` to the existing exported `RiotMatchParticipant` type.

- [ ] **Step 1: Write the failing test for `countDeathsBefore10`**

Create `backend/tests/riot-timeline.test.ts`:

```ts
import "./test_setup.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { countDeathsBefore10, RiotMatchTimeline } from "../src/riot/client.ts";

function timelineWithKills(
  kills: { victimId: number; timestamp: number }[],
): RiotMatchTimeline {
  return {
    info: {
      frames: [
        {
          events: kills.map((k) => ({
            type: "CHAMPION_KILL",
            timestamp: k.timestamp,
            victimId: k.victimId,
          })),
        },
      ],
    },
  };
}

Deno.test("countDeathsBefore10 cuenta solo las muertes del participante antes del minuto 10", () => {
  const timeline = timelineWithKills([
    { victimId: 3, timestamp: 120_000 }, // nuestro jugador, min 2
    { victimId: 3, timestamp: 590_000 }, // nuestro jugador, min ~9.8
    { victimId: 3, timestamp: 650_000 }, // nuestro jugador, pero después del min 10
    { victimId: 7, timestamp: 100_000 }, // otro jugador
  ]);

  assertEquals(countDeathsBefore10(timeline, 3), 2);
});

Deno.test("countDeathsBefore10 devuelve 0 sin muertes antes del minuto 10", () => {
  const timeline = timelineWithKills([{ victimId: 3, timestamp: 700_000 }]);
  assertEquals(countDeathsBefore10(timeline, 3), 0);
});

Deno.test("countDeathsBefore10 ignora eventos que no son CHAMPION_KILL", () => {
  const timeline: RiotMatchTimeline = {
    info: {
      frames: [
        {
          events: [
            { type: "WARD_PLACED", timestamp: 50_000, victimId: 3 },
          ],
        },
      ],
    },
  };
  assertEquals(countDeathsBefore10(timeline, 3), 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `backend/`, with the env vars from Global Constraints exported):
```
deno task test -- --filter "countDeathsBefore10"
```
Expected: FAIL — `countDeathsBefore10` and `RiotMatchTimeline` are not exported from `../src/riot/client.ts` yet (module resolution / type error).

- [ ] **Step 3: Add the types, `getMatchTimeline`, and `countDeathsBefore10` to `client.ts`**

In `backend/src/riot/client.ts`, add `participantId: number;` as a field on the existing `RiotMatchParticipant` type (insert it as the first field, right after the opening brace):

```ts
export type RiotMatchParticipant = {
  participantId: number;
  puuid: string;
  riotIdGameName: string;
  championName: string;
  teamPosition: string;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
};
```

Then append this at the end of the file, after `getMatchById`:

```ts
export type RiotTimelineEvent = {
  type: string;
  timestamp: number;
  victimId?: number;
};

export type RiotTimelineFrame = {
  events: RiotTimelineEvent[];
};

export type RiotMatchTimeline = {
  info: {
    frames: RiotTimelineFrame[];
  };
};

export async function getMatchTimeline(
  matchId: string,
  fetchFn: typeof fetch = fetch,
): Promise<RiotMatchTimeline> {
  const url =
    `https://${ACCOUNT_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
  const res = await riotFetch(url, fetchFn);
  return await res.json();
}

export function countDeathsBefore10(
  timeline: RiotMatchTimeline,
  participantId: number,
): number {
  let count = 0;
  for (const frame of timeline.info.frames) {
    for (const event of frame.events) {
      if (
        event.type === "CHAMPION_KILL" &&
        event.victimId === participantId &&
        event.timestamp < 600_000
      ) {
        count++;
      }
    }
  }
  return count;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno task test -- --filter "countDeathsBefore10"`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint and commit**

```bash
cd backend && deno task lint
git add backend/src/riot/client.ts backend/tests/riot-timeline.test.ts
git commit -m "$(cat <<'EOF'
feat(backend): add Riot match timeline client and deaths-before-10 counter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire `deaths_before_10` into ingestion

**Files:**
- Modify: `backend/src/riot/ingest.ts`

**Interfaces:**
- Consumes: `getMatchTimeline(matchId, fetchFn?)`, `countDeathsBefore10(timeline, participantId)` from Task 1; the `matchMetrics` table's existing `deathsBefore10` column (already in schema, currently never written).
- Produces: `matchMetrics.deathsBefore10` is populated on every future ingestion (was always `null` before this task).

No automated test for this step — `ingestMatches` calls the real Riot API end-to-end and has never had a unit test (a pre-existing, disclosed gap this plan doesn't expand scope to fix). Verification is manual, via Task 11's end-to-end browser check.

- [ ] **Step 1: Import the new functions**

In `backend/src/riot/ingest.ts`, change the import from `./client.ts`:

```ts
import {
  countDeathsBefore10,
  getAccountByRiotId,
  getLeagueEntriesByPuuid,
  getMatchById,
  getMatchIdsByPuuid,
  getMatchTimeline,
  getSummonerByPuuid,
  RiotRateLimitError,
} from "./client.ts";
```

- [ ] **Step 2: Fetch the timeline and count early deaths inside `ingestMatches`**

In `ingestMatches`, right after the block that computes `csTotal`/`minutes`/`teamKills` (the block starting with `const csTotal = ...`), add:

```ts
      let deathsBefore10: number | null = null;
      try {
        const timeline = await getMatchTimeline(riotMatchId);
        deathsBefore10 = countDeathsBefore10(timeline, participant.participantId);
      } catch {
        deathsBefore10 = null;
      }
```

- [ ] **Step 3: Pass `deathsBefore10` into the `matchMetrics` insert**

The existing insert:

```ts
      await db.insert(matchMetrics).values({
        matchParticipantId: participantRow.id,
        csPerMin: csTotal / minutes,
        kda: (participant.kills + participant.assists) /
          Math.max(participant.deaths, 1),
        visionScorePerMin: participant.visionScore / minutes,
        goldPerMin: participant.goldEarned / minutes,
        damagePerMin: participant.totalDamageDealtToChampions / minutes,
        killParticipation: teamKills > 0
          ? (participant.kills + participant.assists) / teamKills
          : 0,
      });
```

becomes:

```ts
      await db.insert(matchMetrics).values({
        matchParticipantId: participantRow.id,
        csPerMin: csTotal / minutes,
        kda: (participant.kills + participant.assists) /
          Math.max(participant.deaths, 1),
        visionScorePerMin: participant.visionScore / minutes,
        deathsBefore10,
        goldPerMin: participant.goldEarned / minutes,
        damagePerMin: participant.totalDamageDealtToChampions / minutes,
        killParticipation: teamKills > 0
          ? (participant.kills + participant.assists) / teamKills
          : 0,
      });
```

- [ ] **Step 4: Lint and commit**

```bash
cd backend && deno task lint
git add backend/src/riot/ingest.ts
git commit -m "$(cat <<'EOF'
feat(backend): populate deaths_before_10 during match ingestion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Rule engine — detect weaknesses

**Files:**
- Create: `backend/src/analysis/weaknesses.ts`
- Test: `backend/tests/weaknesses.test.ts` (create)

**Interfaces:**
- Produces: `MatchStatRow` type, `DetectedWeakness` type, `detectWeaknesses(rows: MatchStatRow[]): DetectedWeakness[]` (pure), `saveWeaknesses(riotAccountId: string): Promise<DetectedWeakness[]>` (DB orchestration — deletes then re-inserts the account's `weaknesses` rows; no-op if fewer than 10 rows).
- Consumes: `db` from `../db/client.ts`, `matchMetrics`/`matchParticipants`/`weaknesses` tables from `../db/schema.ts`.

- [ ] **Step 1: Write the failing tests for `detectWeaknesses`**

Create `backend/tests/weaknesses.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno task test -- --filter "detectWeaknesses|saveWeaknesses"`
Expected: FAIL — `../src/analysis/weaknesses.ts` does not exist yet.

- [ ] **Step 3: Implement `backend/src/analysis/weaknesses.ts`**

```ts
import { eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import { matchMetrics, matchParticipants, weaknesses } from "../db/schema.ts";

export type WeaknessCategory =
  | "farming"
  | "vision"
  | "consistency"
  | "objectives"
  | "early_game";

export type Severity = "low" | "medium" | "high";

export type MatchStatRow = {
  matchParticipantId: string;
  csPerMin: number;
  visionScorePerMin: number;
  kda: number;
  killParticipation: number;
  deathsBefore10: number | null;
};

export type DetectedWeakness = {
  category: WeaknessCategory;
  description: string;
  severity: Severity;
  evidence: string[];
};

const MIN_MATCHES_FOR_DETECTION = 10;

function average(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function worstBy(
  rows: MatchStatRow[],
  key: "csPerMin" | "visionScorePerMin" | "kda" | "killParticipation" | "deathsBefore10",
  ascending: boolean,
  count: number,
): string[] {
  return [...rows]
    .filter((r) => typeof r[key] === "number")
    .sort((a, b) => {
      const av = a[key] as number;
      const bv = b[key] as number;
      return ascending ? av - bv : bv - av;
    })
    .slice(0, count)
    .map((r) => r.matchParticipantId);
}

export function detectWeaknesses(rows: MatchStatRow[]): DetectedWeakness[] {
  const results: DetectedWeakness[] = [];

  const avgCs = average(rows.map((r) => r.csPerMin));
  if (avgCs < 6.0) {
    results.push({
      category: "farming",
      description:
        `Tu CS/min promedio es ${avgCs.toFixed(1)}, por debajo del umbral recomendado de 6.0.`,
      severity: avgCs < 4.0 ? "high" : avgCs < 5.0 ? "medium" : "low",
      evidence: worstBy(rows, "csPerMin", true, 3),
    });
  }

  const avgVision = average(rows.map((r) => r.visionScorePerMin));
  if (avgVision < 0.8) {
    results.push({
      category: "vision",
      description:
        `Tu visión/min promedio es ${avgVision.toFixed(2)}, por debajo del umbral recomendado de 0.8.`,
      severity: avgVision < 0.4 ? "high" : avgVision < 0.6 ? "medium" : "low",
      evidence: worstBy(rows, "visionScorePerMin", true, 3),
    });
  }

  const kdas = rows.map((r) => r.kda);
  const avgKda = average(kdas);
  const variance = average(kdas.map((k) => (k - avgKda) ** 2));
  const stddev = Math.sqrt(variance);
  const cv = avgKda > 0 ? stddev / avgKda : 0;
  if (cv > 0.6) {
    results.push({
      category: "consistency",
      description:
        `Tu KDA varía mucho entre partidas (coeficiente de variación ${
          cv.toFixed(2)
        }, por encima del umbral de 0.6).`,
      severity: cv > 1.0 ? "high" : cv > 0.8 ? "medium" : "low",
      evidence: worstBy(rows, "kda", true, 3),
    });
  }

  const avgKp = average(rows.map((r) => r.killParticipation));
  if (avgKp < 0.5) {
    results.push({
      category: "objectives",
      description:
        `Tu participación en kills promedio es ${
          (avgKp * 100).toFixed(0)
        }%, por debajo del umbral recomendado de 50%.`,
      severity: avgKp < 0.3 ? "high" : avgKp < 0.4 ? "medium" : "low",
      evidence: worstBy(rows, "killParticipation", true, 3),
    });
  }

  const withDeaths10 = rows.filter((r) => r.deathsBefore10 !== null);
  if (withDeaths10.length > 0) {
    const avgDeaths10 = average(withDeaths10.map((r) => r.deathsBefore10 as number));
    if (avgDeaths10 > 1.0) {
      results.push({
        category: "early_game",
        description:
          `Promediás ${
            avgDeaths10.toFixed(1)
          } muertes antes del minuto 10, por encima del umbral de 1.0.`,
        severity: avgDeaths10 > 2.0 ? "high" : avgDeaths10 > 1.5 ? "medium" : "low",
        evidence: worstBy(withDeaths10, "deathsBefore10", false, 3),
      });
    }
  }

  return results;
}

export async function saveWeaknesses(riotAccountId: string): Promise<DetectedWeakness[]> {
  const participants = await db
    .select()
    .from(matchParticipants)
    .where(eq(matchParticipants.riotAccountId, riotAccountId));

  const rows: MatchStatRow[] = [];
  for (const p of participants) {
    const [metrics] = await db
      .select()
      .from(matchMetrics)
      .where(eq(matchMetrics.matchParticipantId, p.id))
      .limit(1);
    if (!metrics) continue;
    rows.push({
      matchParticipantId: p.id,
      csPerMin: metrics.csPerMin,
      visionScorePerMin: metrics.visionScorePerMin,
      kda: metrics.kda,
      killParticipation: metrics.killParticipation,
      deathsBefore10: metrics.deathsBefore10,
    });
  }

  if (rows.length < MIN_MATCHES_FOR_DETECTION) {
    return [];
  }

  const detected = detectWeaknesses(rows);

  await db.delete(weaknesses).where(eq(weaknesses.riotAccountId, riotAccountId));

  if (detected.length > 0) {
    await db.insert(weaknesses).values(
      detected.map((w) => ({
        riotAccountId,
        category: w.category,
        description: w.description,
        severity: w.severity,
        evidence: w.evidence,
      })),
    );
  }

  return detected;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno task test -- --filter "detectWeaknesses|saveWeaknesses"`
Expected: PASS (10 tests).

- [ ] **Step 5: Lint and commit**

```bash
cd backend && deno task lint
git add backend/src/analysis/weaknesses.ts backend/tests/weaknesses.test.ts
git commit -m "$(cat <<'EOF'
feat(backend): add the rules-based weakness detection engine

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire detection into link/sync + docker-compose

**Files:**
- Modify: `backend/src/riot/ingest.ts`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: `saveWeaknesses(riotAccountId)` from Task 3.

- [ ] **Step 1: Call `saveWeaknesses` at the end of `linkRiotAccount` and `syncRiotAccount`**

In `backend/src/riot/ingest.ts`, add the import:

```ts
import { saveWeaknesses } from "../analysis/weaknesses.ts";
```

In `linkRiotAccount`, the current ending:

```ts
  const result = await ingestMatches(riotAccount.id, account.puuid);

  return {
    account: riotAccount,
    ingested: result.processed,
    partial: result.partial,
  };
}
```

becomes:

```ts
  const result = await ingestMatches(riotAccount.id, account.puuid);
  await saveWeaknesses(riotAccount.id);

  return {
    account: riotAccount,
    ingested: result.processed,
    partial: result.partial,
  };
}
```

In `syncRiotAccount`, the current ending:

```ts
  const result = await ingestMatches(riotAccount.id, riotAccount.puuid);

  return {
    account: updatedAccount,
    ingested: result.processed,
    partial: result.partial,
  };
}
```

becomes:

```ts
  const result = await ingestMatches(riotAccount.id, riotAccount.puuid);
  await saveWeaknesses(riotAccount.id);

  return {
    account: updatedAccount,
    ingested: result.processed,
    partial: result.partial,
  };
}
```

- [ ] **Step 2: Add `GEMINI_API_KEY` to `docker-compose.yml`**

In `docker-compose.yml`, the `backend.environment` block currently is:

```yaml
    environment:
      DATABASE_URL: postgres://lol_analytics:lol_analytics@postgres:5432/lol_analytics
      PORT: "8000"
      JWT_SECRET: ${JWT_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      RIOT_API_KEY: ${RIOT_API_KEY}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:3000}
      DENO_ENV: ${DENO_ENV:-development}
```

Add `GEMINI_API_KEY: ${GEMINI_API_KEY}` right after the `RIOT_API_KEY` line:

```yaml
    environment:
      DATABASE_URL: postgres://lol_analytics:lol_analytics@postgres:5432/lol_analytics
      PORT: "8000"
      JWT_SECRET: ${JWT_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      RIOT_API_KEY: ${RIOT_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:3000}
      DENO_ENV: ${DENO_ENV:-development}
```

- [ ] **Step 3: Run the full backend test suite to confirm nothing broke**

Run: `deno task test`
Expected: all tests PASS (existing riot/ai/weaknesses suites unaffected — this task only adds calls, doesn't change any tested return shape).

- [ ] **Step 4: Lint and commit**

```bash
cd backend && deno task lint
git add backend/src/riot/ingest.ts docker-compose.yml
git commit -m "$(cat <<'EOF'
feat(backend): run weakness detection after every Riot link/sync

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Gemini client

**Files:**
- Create: `backend/src/analysis/gemini.ts`
- Test: `backend/tests/gemini.test.ts` (create)

**Interfaces:**
- Produces: `GeminiError` class, `generateExplanation(prompt: string, fetchFn?: typeof fetch): Promise<string>`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/gemini.test.ts`:

```ts
import "./test_setup.ts";
import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import { generateExplanation, GeminiError } from "../src/analysis/gemini.ts";

Deno.env.set("GEMINI_API_KEY", "test-key-for-gemini-tests");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("generateExplanation devuelve el texto de la respuesta de Gemini", async () => {
  const fetchFn = (() =>
    Promise.resolve(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "  Explicación generada.  " }] } }],
      }),
    )) as unknown as typeof fetch;

  const text = await generateExplanation("prompt de prueba", fetchFn);
  assertEquals(text, "Explicación generada.");
});

Deno.test("generateExplanation lanza GeminiError si Gemini responde con error HTTP", async () => {
  const fetchFn = (() =>
    Promise.resolve(jsonResponse({ error: "bad request" }, 400))) as unknown as typeof fetch;

  await assertRejects(() => generateExplanation("prompt", fetchFn), GeminiError);
});

Deno.test("generateExplanation lanza GeminiError si la respuesta no trae texto", async () => {
  const fetchFn = (() =>
    Promise.resolve(jsonResponse({ candidates: [] }))) as unknown as typeof fetch;

  await assertRejects(() => generateExplanation("prompt", fetchFn), GeminiError);
});

Deno.test("generateExplanation lanza GeminiError si no hay API key configurada", async () => {
  const original = Deno.env.get("GEMINI_API_KEY");
  Deno.env.delete("GEMINI_API_KEY");
  try {
    await assertRejects(() => generateExplanation("prompt"), GeminiError);
  } finally {
    if (original !== undefined) Deno.env.set("GEMINI_API_KEY", original);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno task test -- --filter "generateExplanation"`
Expected: FAIL — `../src/analysis/gemini.ts` does not exist yet.

- [ ] **Step 3: Implement `backend/src/analysis/gemini.ts`**

```ts
const GEMINI_MODEL = "gemini-2.0-flash";

export class GeminiError extends Error {}

function getApiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new GeminiError("La variable de entorno GEMINI_API_KEY es requerida");
  }
  return key;
}

export async function generateExplanation(
  prompt: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const apiKey = getApiKey();
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    throw new GeminiError(`Gemini respondió ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim() === "") {
    throw new GeminiError("Gemini no devolvió texto");
  }
  return text.trim();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno task test -- --filter "generateExplanation"`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint and commit**

```bash
cd backend && deno task lint
git add backend/src/analysis/gemini.ts backend/tests/gemini.test.ts
git commit -m "$(cat <<'EOF'
feat(backend): add an injectable Gemini client for plan explanations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Training plan generator

**Files:**
- Create: `backend/src/analysis/trainingPlan.ts`
- Test: `backend/tests/trainingPlan.test.ts` (create)

**Interfaces:**
- Consumes: `getChampionStats(riotAccountId)` from `../riot/ingest.ts` (already exported), `generateExplanation`/`GeminiError` from Task 5, `weaknesses`/`trainingPlans`/`trainingPlanItems`/`planProgress` tables from `../db/schema.ts`.
- Produces: `generateTrainingPlan(riotAccountId: string, explain?: (prompt: string) => Promise<string>): Promise<{ plan: unknown; items: unknown[]; message?: string }>`, `getCurrentTrainingPlan(riotAccountId: string): Promise<{ plan: unknown; items: unknown[] }>`, `markItemProgress(itemId: string, data: { selfRating?: number; note?: string }): Promise<unknown>`.

The `explain` parameter defaults to `generateExplanation` but can be overridden in tests — same dependency-injection pattern as `fetchFn` everywhere else in this codebase.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/trainingPlan.test.ts`:

```ts
import "./test_setup.ts";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";
import { eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../src/db/client.ts";
import {
  matches,
  matchMetrics,
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno task test -- --filter "generateTrainingPlan|getCurrentTrainingPlan|markItemProgress"`
Expected: FAIL — `../src/analysis/trainingPlan.ts` does not exist yet.

- [ ] **Step 3: Implement `backend/src/analysis/trainingPlan.ts`**

```ts
import { and, eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import {
  planProgress,
  trainingPlanItems,
  trainingPlans,
  weaknesses as weaknessesTable,
} from "../db/schema.ts";
import { getChampionStats } from "../riot/ingest.ts";
import { generateExplanation, GeminiError } from "./gemini.ts";

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const DRILL_BY_CATEGORY: Record<string, string> = {
  farming:
    "Jugá 2 partidas normales priorizando no perder oleadas de creeps hasta el minuto 15.",
  vision: "Comprá un control ward cada vez que vuelvas a base durante 3 partidas normales.",
  consistency:
    "Repasá el replay de tu peor partida de la semana y anotá en qué momento se te fue la partida.",
  objectives: "Antes de pelear por un objetivo, esperá a estar agrupado con al menos 2 compañeros.",
  early_game: "Jugá más defensivo en la línea hasta el minuto 10: evitá trades sin ventaja clara.",
};

function currentWeekRange(now = new Date()): { weekStart: string; weekEnd: string } {
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

export async function generateTrainingPlan(
  riotAccountId: string,
  explain: (prompt: string) => Promise<string> = generateExplanation,
) {
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
    const items = await db
      .select()
      .from(trainingPlanItems)
      .where(eq(trainingPlanItems.trainingPlanId, existing.id));
    return { plan: existing, items };
  }

  const currentWeaknesses = await db
    .select()
    .from(weaknessesTable)
    .where(eq(weaknessesTable.riotAccountId, riotAccountId));

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
        `Sos un coach de League of Legends. Con este dato: "${d.description}". ` +
        `Escribí 1-2 oraciones en español explicando este punto del plan de entrenamiento, ` +
        `citando el número exacto que te di. No inventes causas que no estén en el dato.`;
      explanations.push(await explain(prompt));
    }
  } catch (err) {
    if (!(err instanceof GeminiError)) throw err;
    generatedBy = "rules";
    explanations = drafts.map((d) => d.description);
  }

  const [plan] = await db
    .insert(trainingPlans)
    .values({ riotAccountId, weekStart, weekEnd, status: "active", generatedBy })
    .returning();

  const items = await db
    .insert(trainingPlanItems)
    .values(
      drafts.map((d, i) => ({
        trainingPlanId: plan.id,
        type: d.type,
        title: d.title,
        description: d.description,
        llmExplanation: explanations[i],
        evidenceMetricRefs: d.evidenceMetricRefs,
      })),
    )
    .returning();

  return { plan, items };
}

export async function getCurrentTrainingPlan(riotAccountId: string) {
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
    .where(eq(trainingPlanItems.trainingPlanId, plan.id));
  return { plan, items };
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno task test -- --filter "generateTrainingPlan|getCurrentTrainingPlan|markItemProgress"`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint and commit**

```bash
cd backend && deno task lint
git add backend/src/analysis/trainingPlan.ts backend/tests/trainingPlan.test.ts
git commit -m "$(cat <<'EOF'
feat(backend): generate the weekly training plan from detected weaknesses

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Training routes

**Files:**
- Create: `backend/src/routes/training.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/training-routes.test.ts` (create)

**Interfaces:**
- Consumes: `generateTrainingPlan`, `getCurrentTrainingPlan`, `markItemProgress` from Task 6; `verifySessionToken` from `../auth/jwt.ts` (existing); `riotAccounts`/`weaknesses` tables.
- Produces: `trainingRoutes: Hono` exported, mounted at `/riot` in `app.ts` alongside the existing `riotRoutes`.

- [ ] **Step 1: Write the failing route tests**

Create `backend/tests/training-routes.test.ts`:

```ts
import "./test_setup.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { db } from "../src/db/client.ts";
import { riotAccounts, users, weaknesses } from "../src/db/schema.ts";
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

Deno.test("GET /riot/weaknesses rechaza a un usuario no autenticado", async () => {
  const res = await app.request("/riot/weaknesses");
  assertEquals(res.status, 401);
});

Deno.test("GET /riot/weaknesses devuelve lista vacía sin cuenta vinculada", async () => {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  const token = await signSessionToken(user.id);

  const res = await app.request("/riot/weaknesses", {
    headers: { Cookie: `session=${token}` },
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.weaknesses, []);
});

Deno.test("GET /riot/weaknesses devuelve las debilidades guardadas", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  await db.insert(weaknesses).values({
    riotAccountId,
    category: "farming",
    description: "Descripción de prueba",
    severity: "high",
    evidence: [],
  });

  const res = await app.request("/riot/weaknesses", { headers: { Cookie: cookie } });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.weaknesses.length, 1);
  assertEquals(body.weaknesses[0].category, "farming");
});

Deno.test("GET /riot/training-plan devuelve plan null sin plan activo", async () => {
  const { cookie } = await createUserWithRiotAccount();
  const res = await app.request("/riot/training-plan", { headers: { Cookie: cookie } });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.plan, null);
});

Deno.test("POST /riot/training-plan sin cuenta de Riot vinculada devuelve 404", async () => {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  const token = await signSessionToken(user.id);

  const res = await app.request("/riot/training-plan", {
    method: "POST",
    headers: { Cookie: `session=${token}` },
  });
  assertEquals(res.status, 404);
});

Deno.test("POST /riot/training-plan genera un plan a partir de las debilidades guardadas", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  await db.insert(weaknesses).values({
    riotAccountId,
    category: "vision",
    description: "Descripción de prueba",
    severity: "low",
    evidence: [],
  });

  const res = await app.request("/riot/training-plan", {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assertEquals(res.status, 201);
  const body = await res.json();
  // Sin GEMINI_API_KEY configurada en este entorno de test, cae a modo solo-reglas.
  assertEquals(body.plan.generatedBy, "rules");
  assertEquals(body.items.length > 0, true);
});

Deno.test("POST /riot/training-plan/items/:itemId/progress guarda el progreso", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  await db.insert(weaknesses).values({
    riotAccountId,
    category: "vision",
    description: "Descripción de prueba",
    severity: "low",
    evidence: [],
  });
  const planRes = await app.request("/riot/training-plan", {
    method: "POST",
    headers: { Cookie: cookie },
  });
  const { items } = await planRes.json();

  const res = await app.request(
    `/riot/training-plan/items/${items[0].id}/progress`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ selfRating: 5, note: "Listo" }),
    },
  );
  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body.selfRating, 5);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno task test -- --filter "riot/weaknesses|riot/training-plan"`
Expected: FAIL — `404` for all routes (`../src/routes/training.ts` doesn't exist, not mounted).

- [ ] **Step 3: Implement `backend/src/routes/training.ts`**

```ts
import { Context, Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { eq } from "npm:drizzle-orm@^0.36.0";
import { verifySessionToken } from "../auth/jwt.ts";
import { db } from "../db/client.ts";
import { riotAccounts, weaknesses } from "../db/schema.ts";
import {
  generateTrainingPlan,
  getCurrentTrainingPlan,
  markItemProgress,
} from "../analysis/trainingPlan.ts";

const SESSION_COOKIE = "session";

async function requireUserId(c: Context): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  return token ? await verifySessionToken(token) : null;
}

async function getRiotAccountId(userId: string): Promise<string | null> {
  const [account] = await db
    .select({ id: riotAccounts.id })
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, userId))
    .limit(1);
  return account?.id ?? null;
}

export const trainingRoutes = new Hono();

trainingRoutes.get("/weaknesses", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const riotAccountId = await getRiotAccountId(userId);
  if (!riotAccountId) return c.json({ weaknesses: [] });

  const rows = await db
    .select()
    .from(weaknesses)
    .where(eq(weaknesses.riotAccountId, riotAccountId));
  return c.json({ weaknesses: rows });
});

trainingRoutes.get("/training-plan", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const riotAccountId = await getRiotAccountId(userId);
  if (!riotAccountId) return c.json({ plan: null, items: [] });

  const result = await getCurrentTrainingPlan(riotAccountId);
  return c.json(result);
});

trainingRoutes.post("/training-plan", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const riotAccountId = await getRiotAccountId(userId);
  if (!riotAccountId) {
    return c.json({ error: "No tenés una cuenta de Riot vinculada" }, 404);
  }

  const result = await generateTrainingPlan(riotAccountId);
  return c.json(result, 201);
});

trainingRoutes.post("/training-plan/items/:itemId/progress", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const itemId = c.req.param("itemId");
  const body = await c.req.json().catch(() => ({}));
  const progress = await markItemProgress(itemId, {
    selfRating: typeof body.selfRating === "number" ? body.selfRating : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
  });
  return c.json(progress, 201);
});
```

- [ ] **Step 4: Mount `trainingRoutes` in `app.ts`**

In `backend/src/app.ts`, add the import:

```ts
import { trainingRoutes } from "./routes/training.ts";
```

and add a second `.route()` call right after the existing riot one:

```ts
app.route("/riot", riotRoutes);
app.route("/riot", trainingRoutes);
app.route("/ai", aiRoutes);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `deno task test -- --filter "riot/weaknesses|riot/training-plan"`
Expected: PASS (7 tests).

- [ ] **Step 6: Run the full backend suite, lint, and commit**

```bash
cd backend
deno task test
deno task lint
git add backend/src/routes/training.ts backend/src/app.ts backend/tests/training-routes.test.ts
git commit -m "$(cat <<'EOF'
feat(backend): add /riot/weaknesses and /riot/training-plan endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Frontend — Debilidades detectadas page

**Files:**
- Create: `frontend/app/components/WeaknessesList.tsx`
- Create: `frontend/app/dashboard/debilidades/page.tsx`
- Test: `frontend/tests/WeaknessesList.test.tsx` (create)

**Interfaces:**
- Consumes: `GET /riot/weaknesses` → `{ weaknesses: { id, category, description, severity }[] }` (Task 7); `getBackendUrl()` from `../lib/api`; `Navbar`, `LogoutButton` (existing).

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/WeaknessesList.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WeaknessesList } from "../app/components/WeaknessesList";

describe("WeaknessesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra las debilidades devueltas por el backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              weaknesses: [
                {
                  id: "1",
                  category: "farming",
                  description: "Tu CS/min promedio es 3.5.",
                  severity: "high",
                },
              ],
            }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<WeaknessesList />);
    await waitFor(() =>
      expect(screen.getByText(/tu cs\/min promedio es 3.5/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/alta/i)).toBeInTheDocument();
  });

  it("muestra un mensaje cuando todavía no hay debilidades detectadas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ weaknesses: [] }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<WeaknessesList />);
    await waitFor(() =>
      expect(
        screen.getByText(/todavía no detectamos patrones/i),
      ).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run tests/WeaknessesList.test.tsx`
Expected: FAIL — `../app/components/WeaknessesList` does not exist yet.

- [ ] **Step 3: Implement `frontend/app/components/WeaknessesList.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

type Weakness = {
  id: string;
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
};

const CATEGORY_LABELS: Record<string, string> = {
  farming: "Farmeo",
  vision: "Visión",
  consistency: "Consistencia",
  objectives: "Participación en objetivos",
  early_game: "Juego temprano",
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const SEVERITY_CLASSES: Record<string, string> = {
  high: "text-ember border-ember/40",
  medium: "text-gold border-gold/40",
  low: "text-teal border-teal/40",
};

export function WeaknessesList() {
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${getBackendUrl()}/riot/weaknesses`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setWeaknesses(data.weaknesses ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="rune-stagger flex flex-col gap-6 w-full max-w-3xl">
      <h1 className="font-display text-xl font-semibold">Debilidades detectadas</h1>

      {!loaded && <p className="text-mist">Cargando...</p>}

      {loaded && weaknesses.length === 0 && (
        <p className="text-mist text-sm">
          Todavía no detectamos patrones — hace falta al menos 10 partidas guardadas.
        </p>
      )}

      {weaknesses.map((w) => (
        <section key={w.id} className="rune-panel p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display font-semibold">
              {CATEGORY_LABELS[w.category] ?? w.category}
            </h2>
            <span
              className={`text-xs font-medium uppercase tracking-wide border px-2 py-1 ${
                SEVERITY_CLASSES[w.severity]
              }`}
            >
              Severidad {SEVERITY_LABELS[w.severity] ?? w.severity}
            </span>
          </div>
          <p className="text-mist text-sm">{w.description}</p>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create the page**

Create `frontend/app/dashboard/debilidades/page.tsx`:

```tsx
import { Navbar } from "../../components/Navbar";
import { LogoutButton } from "../../components/LogoutButton";
import { WeaknessesList } from "../../components/WeaknessesList";

export default function WeaknessesPage() {
  return (
    <>
      <Navbar actions={<LogoutButton />} />
      <main className="flex flex-col items-center px-6 py-12">
        <WeaknessesList />
      </main>
    </>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run tests/WeaknessesList.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Lint, typecheck, and commit**

```bash
cd frontend
npx next lint
npx tsc --noEmit -p tsconfig.json
git add app/components/WeaknessesList.tsx app/dashboard/debilidades/page.tsx tests/WeaknessesList.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): add the real Debilidades detectadas page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Frontend — Plan de entrenamiento page

**Files:**
- Create: `frontend/app/components/TrainingPlanView.tsx`
- Create: `frontend/app/dashboard/plan/page.tsx`
- Test: `frontend/tests/TrainingPlanView.test.tsx` (create)

**Interfaces:**
- Consumes: `GET /riot/training-plan`, `POST /riot/training-plan`, `POST /riot/training-plan/items/:itemId/progress` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/TrainingPlanView.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrainingPlanView } from "../app/components/TrainingPlanView";

describe("TrainingPlanView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el botón para generar el plan cuando no hay uno activo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ plan: null, items: [] }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<TrainingPlanView />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /generar plan de esta semana/i }),
      ).toBeInTheDocument()
    );
  });

  it("muestra los ítems del plan activo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              plan: { id: "p1", generatedBy: "rules" },
              items: [
                {
                  id: "i1",
                  type: "focus_area",
                  title: "Trabajar: farming",
                  description: "desc",
                  llmExplanation: "Explicación del ítem.",
                },
              ],
            }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<TrainingPlanView />);
    await waitFor(() =>
      expect(screen.getByText(/explicación del ítem/i)).toBeInTheDocument()
    );
  });

  it("marca un ítem como completado", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/progress")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { id: "p1", generatedBy: "rules" },
            items: [
              {
                id: "i1",
                type: "focus_area",
                title: "Trabajar: farming",
                description: "desc",
                llmExplanation: "Explicación del ítem.",
              },
            ],
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<TrainingPlanView />);
    const button = await screen.findByRole("button", { name: /marcar completado/i });
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /completado/i })).toBeDisabled()
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run tests/TrainingPlanView.test.tsx`
Expected: FAIL — `../app/components/TrainingPlanView` does not exist yet.

- [ ] **Step 3: Implement `frontend/app/components/TrainingPlanView.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

type PlanItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  llmExplanation: string | null;
};

type Plan = { id: string; generatedBy: string } | null;

const TYPE_LABELS: Record<string, string> = {
  focus_area: "Foco de la semana",
  drill: "Ejercicio",
  champion_avoid: "Evitar",
  champion_priority: "Priorizar",
};

export function TrainingPlanView() {
  const [plan, setPlan] = useState<Plan>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  async function load() {
    try {
      const res = await fetch(`${getBackendUrl()}/riot/training-plan`, {
        credentials: "include",
      });
      const data = await res.json();
      setPlan(data.plan ?? null);
      setItems(data.items ?? []);
    } catch {
      // Sin conexión: el usuario puede reintentar.
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`${getBackendUrl()}/riot/training-plan`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.message) {
        setMessage(data.message);
      }
      setPlan(data.plan ?? null);
      setItems(data.items ?? []);
    } catch {
      setMessage("No se pudo generar el plan. Intentá de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleComplete(itemId: string) {
    try {
      await fetch(
        `${getBackendUrl()}/riot/training-plan/items/${itemId}/progress`,
        { method: "POST", credentials: "include" },
      );
      setCompletedIds((prev) => [...prev, itemId]);
    } catch {
      // Sin conexión: el usuario puede reintentar con el mismo botón.
    }
  }

  if (!loaded) {
    return <p className="text-mist">Cargando...</p>;
  }

  return (
    <div className="rune-stagger flex flex-col gap-6 w-full max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-display text-xl font-semibold">
          Plan de entrenamiento semanal
        </h1>
        {!plan && (
          <button onClick={handleGenerate} disabled={generating} className="rune-btn">
            {generating ? "Generando..." : "Generar plan de esta semana"}
          </button>
        )}
      </div>

      {message && <p className="text-mist text-sm">{message}</p>}

      {items.map((item) => {
        const done = completedIds.includes(item.id);
        return (
          <section key={item.id} className="rune-panel p-6 flex flex-col gap-2">
            <span className="text-mist text-xs uppercase tracking-wide">
              {TYPE_LABELS[item.type] ?? item.type}
            </span>
            <h2 className="font-display font-semibold">{item.title}</h2>
            <p className="text-mist text-sm leading-relaxed">
              {item.llmExplanation ?? item.description}
            </p>
            <button
              onClick={() => handleComplete(item.id)}
              disabled={done}
              className="rune-btn self-start mt-2"
            >
              {done ? "Completado" : "Marcar completado"}
            </button>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create the page**

Create `frontend/app/dashboard/plan/page.tsx`:

```tsx
import { Navbar } from "../../components/Navbar";
import { LogoutButton } from "../../components/LogoutButton";
import { TrainingPlanView } from "../../components/TrainingPlanView";

export default function TrainingPlanPage() {
  return (
    <>
      <Navbar actions={<LogoutButton />} />
      <main className="flex flex-col items-center px-6 py-12">
        <TrainingPlanView />
      </main>
    </>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run tests/TrainingPlanView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Lint, typecheck, and commit**

```bash
cd frontend
npx next lint
npx tsc --noEmit -p tsconfig.json
git add app/components/TrainingPlanView.tsx app/dashboard/plan/page.tsx tests/TrainingPlanView.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): add the real Plan de entrenamiento semanal page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Dashboard teasers

**Files:**
- Create: `frontend/app/components/DashboardTeasers.tsx`
- Modify: `frontend/app/components/DashboardContent.tsx`
- Test: `frontend/tests/DashboardTeasers.test.tsx` (create)

**Interfaces:**
- Consumes: `GET /riot/weaknesses`, `GET /riot/training-plan` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/DashboardTeasers.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardTeasers } from "../app/components/DashboardTeasers";

describe("DashboardTeasers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra la debilidad más urgente y el estado del plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (typeof url === "string" && url.includes("/riot/weaknesses")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                weaknesses: [
                  {
                    id: "1",
                    category: "farming",
                    description: "Tu CS/min promedio es 3.5.",
                    severity: "high",
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ plan: null, items: [] }),
        });
      }) as unknown as typeof fetch,
    );

    render(<DashboardTeasers />);
    await waitFor(() =>
      expect(screen.getByText(/debilidad más urgente/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/todavía no generaste un plan/i)).toBeInTheDocument();
  });

  it("no renderiza nada sin debilidades detectadas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ weaknesses: [] }),
        }),
      ) as unknown as typeof fetch,
    );

    const { container } = render(<DashboardTeasers />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run tests/DashboardTeasers.test.tsx`
Expected: FAIL — `../app/components/DashboardTeasers` does not exist yet.

- [ ] **Step 3: Implement `frontend/app/components/DashboardTeasers.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

type Weakness = {
  id: string;
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
};

const SEVERITY_LABELS: Record<string, string> = { high: "Alta", medium: "Media", low: "Baja" };
const SEVERITY_CLASSES: Record<string, string> = {
  high: "text-ember",
  medium: "text-gold",
  low: "text-teal",
};
const CATEGORY_LABELS: Record<string, string> = {
  farming: "Farmeo",
  vision: "Visión",
  consistency: "Consistencia",
  objectives: "Participación en objetivos",
  early_game: "Juego temprano",
};

export function DashboardTeasers() {
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [hasPlan, setHasPlan] = useState(false);
  const [planItemCount, setPlanItemCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${getBackendUrl()}/riot/weaknesses`, { credentials: "include" }).then((r) =>
        r.json()
      ),
      fetch(`${getBackendUrl()}/riot/training-plan`, { credentials: "include" }).then((r) =>
        r.json()
      ),
    ])
      .then(([w, p]) => {
        setWeaknesses(w.weaknesses ?? []);
        setHasPlan(Boolean(p.plan));
        setPlanItemCount((p.items ?? []).length);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || weaknesses.length === 0) return null;

  const topWeakness = weaknesses[0];

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <a
        href="/dashboard/debilidades"
        className="rune-panel p-5 flex flex-col gap-2 hover:bg-panel-line/20 transition-colors"
      >
        <span className="text-mist text-xs uppercase tracking-wide">
          Debilidad más urgente
        </span>
        <h3 className={`font-display font-semibold ${SEVERITY_CLASSES[topWeakness.severity]}`}>
          {SEVERITY_LABELS[topWeakness.severity]} — {CATEGORY_LABELS[topWeakness.category] ??
            topWeakness.category}
        </h3>
        <p className="text-mist text-sm">{topWeakness.description}</p>
        <span className="rune-link text-sm">Ver todas las debilidades →</span>
      </a>
      <a
        href="/dashboard/plan"
        className="rune-panel p-5 flex flex-col gap-2 hover:bg-panel-line/20 transition-colors"
      >
        <span className="text-mist text-xs uppercase tracking-wide">Plan de esta semana</span>
        <h3 className="font-display font-semibold text-parchment">
          {hasPlan ? `${planItemCount} ítems` : "Todavía no generaste un plan"}
        </h3>
        <span className="rune-link text-sm">Ver plan completo →</span>
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `DashboardContent.tsx`**

In `frontend/app/components/DashboardContent.tsx`, add the import:

```ts
import { DashboardTeasers } from "./DashboardTeasers";
```

and render it right after `<RiotAccountCard emailVerified={me.emailVerified} />`:

```tsx
        <RiotAccountCard emailVerified={me.emailVerified} />
        <DashboardTeasers />
      </div>
```

(the closing `</div>` above was already there — `DashboardTeasers` is a new sibling of `RiotAccountCard`, both inside the existing `rune-stagger` wrapper div.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run tests/DashboardTeasers.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full frontend suite, lint, typecheck, and commit**

```bash
cd frontend
npx vitest run
npx next lint
npx tsc --noEmit -p tsconfig.json
git add app/components/DashboardTeasers.tsx app/components/DashboardContent.tsx tests/DashboardTeasers.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): show real weakness/plan teasers on the dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Bring up Postgres and export backend env vars**

```bash
docker compose up -d postgres
```

If Docker isn't running, launch `C:\Users\mejia\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe` first and wait for `docker info` to succeed.

Export (values from `.env`, see Global Constraints):
```bash
export DATABASE_URL="postgres://lol_analytics:lol_analytics@localhost:5433/lol_analytics"
export JWT_SECRET="<value from .env>"
export RESEND_API_KEY="<value from .env>"
export RIOT_API_KEY="<value from .env>"
export GEMINI_API_KEY="<value from .env>"
export FRONTEND_URL="http://localhost:3000"
```

- [ ] **Step 2: Run the full backend and frontend suites one more time together**

```bash
cd backend && deno task db:migrate && deno task test
cd ../frontend && npx vitest run && npx next lint && npx tsc --noEmit -p tsconfig.json
```
Expected: everything PASS.

- [ ] **Step 3: Start both dev servers**

```bash
cd backend && deno task start &
cd frontend && NEXT_PUBLIC_BACKEND_URL="http://localhost:8000" npm run dev &
```

- [ ] **Step 4: Walk the real flow in a browser**

Using a test account that already has a Riot account linked with ≥10 matches (or link one, per the earlier session's pattern):
1. Log in, land on `/dashboard`.
2. Click "Actualizar partidas" — confirm it completes (this now also fetches 10 timelines and runs detection; expect it to take noticeably longer than before).
3. Confirm the two new teaser cards appear on the dashboard (or don't, if genuinely no weaknesses were detected — in that case check `/dashboard/debilidades` directly shows the "todavía no detectamos patrones" message only if <10 matches, otherwise the account is just clean).
4. Visit `/dashboard/debilidades` — confirm real weakness cards render with real numbers in the description.
5. Visit `/dashboard/plan`, click "Generar plan de esta semana" — confirm items render, each with either a Gemini-written explanation or (if `GEMINI_API_KEY` is invalid/unset) the same text as the rule description — check the backend logs to see whether it's actually reaching Gemini or falling back.
6. Click "Marcar completado" on one item — confirm the button flips to "Completado" and stays disabled.
7. Reload `/dashboard/plan` — confirm clicking "Generar plan de esta semana" again does *not* create a duplicate (the button shouldn't even show if a plan is already active this week).

- [ ] **Step 5: Fix anything the manual walkthrough surfaces, then stop the dev servers**

If something in Step 4 doesn't match, fix it, re-run the relevant automated test, and commit the fix separately before continuing.
