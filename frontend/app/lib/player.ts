export const ROLES = [
  { id: "TOP", name: "Superior" },
  { id: "JUNGLE", name: "Jungla" },
  { id: "MIDDLE", name: "Central" },
  { id: "BOTTOM", name: "Tirador" },
  { id: "UTILITY", name: "Soporte" },
];
export const AREAS = [
  { id: "farming", name: "Farmeo" },
  { id: "vision", name: "Visión" },
  { id: "early_game", name: "Juego temprano" },
  { id: "consistency", name: "Consistencia" },
  { id: "objectives", name: "Objetivos y equipo" },
  { id: "mechanics", name: "Mecánicas y kiteo" },
  { id: "wave_control", name: "Control de oleadas" },
  { id: "positioning", name: "Posicionamiento" },
  { id: "itemization", name: "Runas y compras" },
];
export const UNIVERSITIES = [
  "Universidad de San Carlos de Guatemala",
  "Universidad Rafael Landívar",
  "Universidad del Valle de Guatemala",
  "Universidad Mariano Gálvez",
  "Universidad Galileo",
  "Universidad Francisco Marroquín",
  "Universidad del Istmo",
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
  rankingVisible: boolean;
};
export type PlayerProfile = PlayerPreferences & {
  onboardingCompleted: boolean;
  updatedAt: string;
};
export type ProfileResponse = {
  profile: PlayerProfile | null;
  account: {
    summonerName: string;
    tagLine: string;
    soloTier: string | null;
    soloRank: string | null;
    soloLp: number | null;
    region: string;
  } | null;
};
export const emptyPreferences: PlayerPreferences = {
  primaryRole: null,
  secondaryRole: null,
  champions: [],
  experience: null,
  improvementAreas: [],
  targetRoles: [],
  weeklyMinutes: null,
  universityName: null,
  rankingVisible: false,
};
