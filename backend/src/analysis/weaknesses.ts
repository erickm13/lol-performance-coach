import { desc, eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import {
  matches,
  matchMetrics,
  matchParticipants,
  riotAccounts,
  weaknesses,
} from "../db/schema.ts";
export const RULES_VERSION = "role-practice-v1";
export const DETECTION_WINDOW = 10;
export const MIN_MATCHES_FOR_DETECTION = 10;
export type WeaknessCategory =
  | "farming"
  | "vision"
  | "consistency"
  | "objectives"
  | "early_game";
export type Severity = "low" | "medium" | "high";
export type MatchStatRow = {
  matchParticipantId: string;
  role?: string | null;
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
// Transparent practice references, not official rank percentiles or professional benchmarks.
export const ROLE_REFERENCES: Record<
  string,
  { cs: number | null; vision: number; participation: number; label: string }
> = {
  TOP: { cs: 6, vision: .6, participation: .35, label: "Superior" },
  JUNGLE: { cs: 5.5, vision: .9, participation: .5, label: "Jungla" },
  MIDDLE: { cs: 6, vision: .6, participation: .45, label: "Central" },
  BOTTOM: { cs: 6.5, vision: .6, participation: .45, label: "Tirador" },
  UTILITY: { cs: null, vision: 1.5, participation: .5, label: "Soporte" },
};
const GENERAL = {
  cs: 6,
  vision: .8,
  participation: .5,
  label: "Sin rol disponible (referencia general)",
};
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const reference = (row: MatchStatRow) =>
  ROLE_REFERENCES[row.role ?? ""] ?? GENERAL;
const evidence = (
  rows: MatchStatRow[],
  score: (row: MatchStatRow) => number,
  descending = false,
) =>
  [...rows].sort((a, b) => (descending ? -1 : 1) * (score(a) - score(b))).slice(
    0,
    3,
  ).map((row) => row.matchParticipantId);
const basis = (rows: MatchStatRow[]) =>
  `${rows.length} partidas; ${
    [...new Set(rows.map((row) => reference(row).label))].join(", ")
  }`;
export function detectWeaknesses(rows: MatchStatRow[]): DetectedWeakness[] {
  if (!rows.length) return [];
  const results: DetectedWeakness[] = [];
  const farm = rows.filter((row) => reference(row).cs !== null);
  if (farm.length) {
    const actual = mean(farm.map((r) => r.csPerMin)),
      target = mean(farm.map((r) => reference(r).cs!));
    const ratio = actual / target;
    if (ratio < 1) {
      results.push({
        category: "farming",
        description: `Tu CS/min promedio es ${
          actual.toFixed(1)
        } frente a una referencia interna de práctica de ${
          target.toFixed(1)
        } ajustada a los roles jugados (${
          basis(farm)
        }). Las partidas de soporte no se incluyen en farmeo.`,
        severity: ratio < 2 / 3 ? "high" : ratio < 5 / 6 ? "medium" : "low",
        evidence: evidence(farm, (r) => r.csPerMin / reference(r).cs!),
      });
    }
  }
  const avgVision = mean(rows.map((r) => r.visionScorePerMin)),
    visionTarget = mean(rows.map((r) => reference(r).vision));
  if (avgVision < visionTarget) {
    results.push({
      category: "vision",
      description: `Tu visión/min promedio es ${
        avgVision.toFixed(2)
      } frente a una referencia interna de ${
        visionTarget.toFixed(2)
      } para los roles jugados (${
        basis(rows)
      }). El índice no mide por sí solo la calidad de tus wards.`,
      severity: avgVision / visionTarget < .5
        ? "high"
        : avgVision / visionTarget < .75
        ? "medium"
        : "low",
      evidence: evidence(
        rows,
        (r) => r.visionScorePerMin / reference(r).vision,
      ),
    });
  }
  const groups = new Map<string, MatchStatRow[]>();
  for (const row of rows) {
    const key = ROLE_REFERENCES[row.role ?? ""] ? row.role! : "unknown";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const variable =
    [...groups.values()].filter((group) => group.length >= 3).map((group) => {
      const avg = mean(group.map((r) => r.kda));
      return {
        group,
        cv: avg > 0
          ? Math.sqrt(mean(group.map((r) => (r.kda - avg) ** 2))) / avg
          : 0,
      };
    }).sort((a, b) => b.cv - a.cv)[0];
  if (variable && variable.cv > .6) {
    results.push({
      category: "consistency",
      description:
        `Tu KDA varía entre partidas del mismo rol (coeficiente de variación ${
          variable.cv.toFixed(2)
        }, referencia interna 0.60; ${
          basis(variable.group)
        }). Se comparan grupos de al menos tres partidas para evitar mezclar roles distintos.`,
      severity: variable.cv > 1 ? "high" : variable.cv > .8 ? "medium" : "low",
      evidence: evidence(variable.group, (r) => r.kda),
    });
  }
  const kp = mean(rows.map((r) => r.killParticipation)),
    kpTarget = mean(rows.map((r) => reference(r).participation));
  if (kp < kpTarget) {
    results.push({
      category: "objectives",
      description: `Tu participación en kills promedio es ${
        (kp * 100).toFixed(0)
      }% frente a una referencia interna de ${
        (kpTarget * 100).toFixed(0)
      }% ajustada por rol (${
        basis(rows)
      }). Este dato orienta la revisión del juego en equipo; no demuestra participación en dragones o torres.`,
      severity: kp / kpTarget < .6
        ? "high"
        : kp / kpTarget < .8
        ? "medium"
        : "low",
      evidence: evidence(
        rows,
        (r) => r.killParticipation / reference(r).participation,
      ),
    });
  }
  const early = rows.filter((r) => r.deathsBefore10 !== null);
  const deaths = mean(early.map((r) => r.deathsBefore10!));
  if (early.length && deaths > 1) {
    results.push({
      category: "early_game",
      description: `Promedias ${
        deaths.toFixed(1)
      } muertes antes del minuto 10 (${
        basis(early)
      }), por encima de la referencia interna de 1.0. Revisa el contexto antes de atribuir una causa.`,
      severity: deaths > 2 ? "high" : deaths > 1.5 ? "medium" : "low",
      evidence: evidence(early, (r) => r.deathsBefore10!, true),
    });
  }
  return results;
}
export async function saveWeaknesses(
  riotAccountId: string,
): Promise<DetectedWeakness[]> {
  const recent = await db.select({
    id: matchParticipants.id,
    role: matchParticipants.role,
    metrics: matchMetrics,
  }).from(matchParticipants).innerJoin(
    matches,
    eq(matchParticipants.matchId, matches.id),
  ).leftJoin(
    matchMetrics,
    eq(matchMetrics.matchParticipantId, matchParticipants.id),
  ).where(eq(matchParticipants.riotAccountId, riotAccountId)).orderBy(
    desc(matches.gameCreation),
  ).limit(DETECTION_WINDOW);
  const rows: MatchStatRow[] = recent.flatMap((row) =>
    row.metrics
      ? [{ ...row.metrics, role: row.role, matchParticipantId: row.id }]
      : []
  );
  if (rows.length < MIN_MATCHES_FOR_DETECTION) return [];
  const detected = detectWeaknesses(rows);
  await db.transaction(async (tx) => {
    await tx.delete(weaknesses).where(
      eq(weaknesses.riotAccountId, riotAccountId),
    );
    if (detected.length) {
      await tx.insert(weaknesses).values(
        detected.map((w) => ({ riotAccountId, ...w })),
      );
    }
    await tx.update(riotAccounts).set({ analysisVersion: RULES_VERSION }).where(
      eq(riotAccounts.id, riotAccountId),
    );
  });
  return detected;
}
