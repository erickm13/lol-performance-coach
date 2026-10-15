import { eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import { playerProfiles } from "../db/schema.ts";
export const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export const ROLE_LABELS: Record<string, string> = {
  TOP: "Superior",
  JUNGLE: "Jungla",
  MIDDLE: "Central",
  BOTTOM: "Tirador",
  UTILITY: "Soporte",
};
export const AREAS = [
  "farming",
  "vision",
  "early_game",
  "consistency",
  "objectives",
  "mechanics",
  "wave_control",
  "positioning",
  "itemization",
] as const;
export const AREA_LABELS: Record<string, string> = {
  farming: "Farmeo",
  vision: "Visión",
  early_game: "Juego temprano",
  consistency: "Consistencia",
  objectives: "Objetivos y juego en equipo",
  mechanics: "Mecánicas y kiteo",
  wave_control: "Control de oleadas",
  positioning: "Posicionamiento",
  itemization: "Runas y compras",
};
export const UNIVERSITIES = [
  { id: "usac", name: "Universidad de San Carlos de Guatemala" },
  { id: "url", name: "Universidad Rafael Landívar" },
  { id: "uvg", name: "Universidad del Valle de Guatemala" },
  { id: "umg", name: "Universidad Mariano Gálvez" },
  { id: "galileo", name: "Universidad Galileo" },
  { id: "ufm", name: "Universidad Francisco Marroquín" },
  { id: "unis", name: "Universidad del Istmo" },
];
export type PlayerPreferences = {
  primaryRole: string | null;
  secondaryRole: string | null;
  champions: string[];
  experience: string | null;
  improvementAreas: string[];
  targetRoles: string[];
  weeklyMinutes: number | null;
  universityName: string | null;
  universityKey: string | null;
  rankingVisible: boolean;
  onboardingCompleted: boolean;
};
export class ProfileValidationError extends Error {}
const fail = (text: string): never => {
  throw new ProfileValidationError(text);
};
export function parsePreferences(input: unknown): PlayerPreferences {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("El perfil del jugador no es válido.");
  }
  const body = input as Record<string, unknown>;
  function choice(key: string, choices: readonly string[]) {
    const value = body[key];
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string" || !choices.includes(value)) {
      return fail(`Revisa el campo ${key}.`);
    }
    return value;
  }
  function list(key: string, limit: number, valid: (value: string) => boolean) {
    const value = body[key] ?? [];
    if (
      !Array.isArray(value) || value.length > limit ||
      value.some((item) => typeof item !== "string" || !valid(item))
    ) return fail(`Revisa las opciones de ${key}.`);
    return [...new Set(value as string[])];
  }
  const primaryRole = choice("primaryRole", ROLES);
  const secondaryRole = choice("secondaryRole", ROLES);
  if (primaryRole && primaryRole === secondaryRole) {
    return fail("Elige una línea secundaria diferente de la principal.");
  }
  const experience = choice("experience", [
    "beginner",
    "intermediate",
    "advanced",
  ]);
  const champions = list(
    "champions",
    12,
    (item) => /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(item),
  );
  const improvementAreas = list(
    "improvementAreas",
    6,
    (item) => (AREAS as readonly string[]).includes(item),
  );
  const targetRoles = list(
    "targetRoles",
    5,
    (item) => (ROLES as readonly string[]).includes(item),
  );
  const weeklyMinutes =
    body.weeklyMinutes === null || body.weeklyMinutes === undefined ||
      body.weeklyMinutes === ""
      ? null
      : body.weeklyMinutes;
  if (
    weeklyMinutes !== null &&
    (typeof weeklyMinutes !== "number" || !Number.isInteger(weeklyMinutes) ||
      weeklyMinutes < 15 || weeklyMinutes > 10080)
  ) return fail("El tiempo semanal debe estar entre 15 y 10080 minutos.");
  if (
    body.rankingVisible !== undefined &&
    typeof body.rankingVisible !== "boolean"
  ) return fail("La preferencia de ranking no es válida.");
  const university = body.universityName;
  if (
    university !== null && university !== undefined &&
    typeof university !== "string"
  ) return fail("La universidad no es válida.");
  const name = typeof university === "string"
    ? university.trim().replace(/\s+/g, " ")
    : "";
  if (
    name.length > 120 ||
    ([...name].some((character) => character.charCodeAt(0) < 32) ||
      /[<>]/.test(name))
  ) return fail("La universidad debe tener hasta 120 caracteres de texto.");
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(
      /[^\p{L}\p{N}]+/gu,
      " ",
    ).trim();
  const known = UNIVERSITIES.find((item) =>
    normalize(item.name) === normalize(name) || item.id === normalize(name)
  );
  const universityName = name ? known?.name ?? name : null;
  const universityKey = name
    ? known?.id ?? normalize(name).replace(/ /g, "-")
    : null;
  if (name && !universityKey) {
    return fail("Escribe el nombre de tu universidad o deja el campo vacío.");
  }
  return {
    primaryRole,
    secondaryRole,
    champions,
    experience,
    improvementAreas,
    targetRoles,
    weeklyMinutes: weeklyMinutes as number | null,
    universityName,
    universityKey,
    rankingVisible: body.rankingVisible === true,
    onboardingCompleted: Boolean(
      primaryRole && experience && improvementAreas.length,
    ),
  };
}
export async function readPlayerProfile(userId: string) {
  const [profile] = await db.select().from(playerProfiles).where(
    eq(playerProfiles.userId, userId),
  ).limit(1);
  return profile ?? null;
}
export function coachPreferences(
  profile: typeof playerProfiles.$inferSelect | null,
) {
  if (!profile) return null;
  return {
    primaryRole: profile.primaryRole,
    secondaryRole: profile.secondaryRole,
    champions: profile.champions,
    experience: profile.experience,
    goals: profile.improvementAreas,
    targetRoles: profile.targetRoles,
    weeklyMinutes: profile.weeklyMinutes,
  };
}
