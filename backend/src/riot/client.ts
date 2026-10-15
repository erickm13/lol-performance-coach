const ACCOUNT_REGION = "americas";
const PLATFORM = "la1";

export class RiotNotFoundError extends Error {}
export class RiotAuthError extends Error {}
export class RiotRateLimitError extends Error {}
export class RiotApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getApiKey(): string {
  const key = Deno.env.get("RIOT_API_KEY");
  if (!key) {
    throw new Error("La variable de entorno RIOT_API_KEY es requerida");
  }
  return key;
}

async function riotFetch(
  url: string,
  fetchFn: typeof fetch,
): Promise<Response> {
  const res = await fetchFn(url, {
    headers: { "X-Riot-Token": getApiKey() },
  });

  if (res.status === 404) {
    throw new RiotNotFoundError("No encontrado en Riot");
  }
  if (res.status === 403) {
    throw new RiotAuthError("Clave de API de Riot inválida o vencida");
  }
  if (res.status === 429) {
    throw new RiotRateLimitError("Rate limit de Riot alcanzado");
  }
  if (!res.ok) {
    throw new RiotApiError(res.status, `Riot respondió ${res.status}`);
  }

  return res;
}

export type RiotAccount = { puuid: string; gameName: string; tagLine: string };

export async function getAccountByRiotId(
  gameName: string,
  tagLine: string,
  fetchFn: typeof fetch = fetch,
): Promise<RiotAccount> {
  const url =
    `https://${ACCOUNT_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${
      encodeURIComponent(gameName)
    }/${encodeURIComponent(tagLine)}`;
  const res = await riotFetch(url, fetchFn);
  return await res.json();
}

export type RiotSummoner = {
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
};

export async function getSummonerByPuuid(
  puuid: string,
  fetchFn: typeof fetch = fetch,
): Promise<RiotSummoner> {
  const url =
    `https://${PLATFORM}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  const res = await riotFetch(url, fetchFn);
  return await res.json();
}

export async function getMatchIdsByPuuid(
  puuid: string,
  count: number,
  fetchFn: typeof fetch = fetch,
): Promise<string[]> {
  const url =
    `https://${ACCOUNT_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
  const res = await riotFetch(url, fetchFn);
  return await res.json();
}

export type RiotLeagueEntry = {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

export async function getLeagueEntriesByPuuid(
  puuid: string,
  fetchFn: typeof fetch = fetch,
): Promise<RiotLeagueEntry[]> {
  const url =
    `https://${PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
  const res = await riotFetch(url, fetchFn);
  return await res.json();
}

export type RiotMatchParticipant = {
  participantId: number;
  puuid: string;
  riotIdGameName: string;
  profileIcon: number;
  riotIdTagline?: string;
  summoner1Id?: number;
  summoner2Id?: number;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
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

export type RiotMatch = {
  info: {
    mapId?: number;
    gameVersion: string;
    queueId: number;
    gameCreation: number;
    gameDuration: number;
    participants: RiotMatchParticipant[];
  };
};

export async function getMatchById(
  matchId: string,
  fetchFn: typeof fetch = fetch,
): Promise<RiotMatch> {
  const url =
    `https://${ACCOUNT_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  const res = await riotFetch(url, fetchFn);
  return await res.json();
}

export type RiotTimelineEvent = {
  type: string;
  timestamp: number;
  creatorId?: number;
  participantId?: number;
  killerTeamId?: number;
  teamId?: number;
  itemId?: number;
  beforeId?: number;
  afterId?: number;
  wardType?: string;
  monsterType?: string;
  monsterSubType?: string;
  buildingType?: string;
  towerType?: string;
  victimId?: number;
  killerId?: number;
  assistingParticipantIds?: number[];
  position?: { x: number; y: number };
};

export type RiotParticipantFrame = {
  participantId: number;
  position?: { x: number; y: number };
  level?: number;
  totalGold?: number;
  currentGold?: number;
  minionsKilled?: number;
  jungleMinionsKilled?: number;
  championStats?: { health?: number; healthMax?: number };
};

export type RiotTimelineFrame = {
  timestamp?: number;
  participantFrames?: Record<string, RiotParticipantFrame>;
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
