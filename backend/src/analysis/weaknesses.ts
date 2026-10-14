import { desc, eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import { matches, matchMetrics, matchParticipants, weaknesses } from "../db/schema.ts";

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

/**
 * Ventana de análisis: la detección siempre corre sobre las últimas 10 partidas
 * (§2 y §3 del diseño), no sobre todo el historial acumulado — que crece sin
 * límite y convertiría la detección en un promedio de por vida. Coincide con
 * las 10 partidas que el dashboard muestra.
 */
const DETECTION_WINDOW = 10;

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
    .select({ id: matchParticipants.id })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .where(eq(matchParticipants.riotAccountId, riotAccountId))
    .orderBy(desc(matches.gameCreation))
    .limit(DETECTION_WINDOW);

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
