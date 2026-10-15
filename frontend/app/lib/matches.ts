export type RawStats = Record<string, number | undefined>;
export type MatchMetrics = {
  csPerMin: number;
  kda: number;
  visionScorePerMin: number;
  goldPerMin: number;
  damagePerMin: number;
  killParticipation: number;
  deathsBefore10: number | null;
};
export type MatchMetadata = {
  id: string;
  riotMatchId: string;
  queueId: number | null;
  gameCreation: string;
  gameDurationSeconds: number;
  patchVersion: string | null;
};
export type MatchParticipant = {
  id?: string;
  champion: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  csTotal: number;
  goldTotal: number;
  damageTotal: number;
  visionScore: number;
  teamId: number;
  role: string | null;
  rawStats: RawStats | null;
};
export type StoredMatch = MatchParticipant & {
  match: MatchMetadata;
  metrics: MatchMetrics | null;
};
export type HistoryResponse = {
  matches: StoredMatch[];
  linked: boolean;
  storedTotal?: number;
  summary?: {
    wins: number;
    losses: number;
    winRate: number;
    averageKda: number | null;
    averageCsPerMin: number | null;
    metricsCount: number;
  };
  pagination: { page: number; limit: number; total: number; pages: number };
};
export type MomentContext = {
  killer: string | null;
  victim: string | null;
  assistants: string[];
  scoreBefore: { kills: number; deaths: number; assists: number };
  snapshot: {
    timestamp: number;
    ageSeconds: number;
    self: {
      level: number | null;
      totalGold: number | null;
      unspentGold: number | null;
      cs: number | null;
      healthPercent: number | null;
    };
    opponentByRole: {
      champion: string;
      level: number | null;
      goldDifference: number | null;
      csDifference: number | null;
    } | null;
    nearby: {
      position?: { x: number; y: number };
      champion: string;
      side: "ally" | "enemy";
      distance: number;
      level: number | null;
    }[];
  } | null;
  wardsLast120s: { selfPlaced: number; teamPlaced: number; teamKilled: number };
  nearbyKills: {
    secondsFromEvent: number;
    killer: string | null;
    victim: string | null;
    victimSide: "ally" | "enemy" | "unknown";
  }[];
  objectives?: {
    secondsFromEvent: number;
    type: string;
    monster: string | null;
    position?: { x: number; y: number } | null;
  }[];
};
export type MatchEvent = {
  context?: MomentContext;
  timestamp: number;
  kind: "kill" | "death" | "assist";
  position: { x: number; y: number };
};
export type MatchDetail = {
  match: MatchMetadata;
  participant: MatchParticipant;
  metrics: MatchMetrics | null;
  participants:
    (MatchParticipant & { summonerName: string; isSelf: boolean })[];
  events: MatchEvent[];
  detailAvailable: boolean;
  timelineAvailable: boolean;
  mapId: number | null;
  warning: string | null;
};
const QUEUES: Record<number, string> = {
  400: "Normal · Reclutamiento",
  420: "Clasificatoria Solo/Dúo",
  430: "Normal · Selección oculta",
  440: "Clasificatoria Flexible",
  450: "ARAM",
  490: "Partida rápida",
  1700: "Arena",
};
export function queueName(id: number | null) {
  return id === null ? "Cola sin datos" : QUEUES[id] ?? `Cola ${id}`;
}
export function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function matchDate(date: string) {
  return new Date(date).toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type MapSuggestion = {
  eventIndex: number;
  assessment: "error" | "possible_error";
  mistakeTitle: string;
  mistake: string;
  title: string;
  advice: string;
  action: "retreat" | "vision" | "group";
};
export type GoodPlay = {
  eventIndex: number;
  title: string;
  explanation: string;
};
export type MapInsights = {
  version: number;
  generatedAt: string;
  suggestions: MapSuggestion[];
  goodPlays: GoodPlay[];
  observations: GoodPlay[];
  progress: { evaluated: number; total: number; complete: boolean };
};
