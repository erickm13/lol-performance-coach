export const CLIENT_PHASES = [
  "None",
  "Lobby",
  "Matchmaking",
  "ReadyCheck",
  "ChampSelect",
  "GameStart",
  "InProgress",
  "WaitingForStats",
  "PreEndOfGame",
  "EndOfGame",
  "Reconnect",
  "ClientClosed",
  "ClientUnavailable",
  "Unsupported",
] as const;
export type DraftSlot = {
  cellId: number;
  championId: number;
  intentId: number;
  role: string | null;
  lockedIn: boolean;
};
export type LiveDraftSnapshot = {
  version: 1;
  phase: typeof CLIENT_PHASES[number];
  draftId: string | null;
  localCellId: number | null;
  mapId: number | null;
  queueId: number | null;
  gameMode: string;
  myTeam: DraftSlot[];
  theirTeam: DraftSlot[];
  bans: number[];
  availableChampionIds: number[] | null;
};
const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Formato de selección inválido.");
  }
  return value as Record<string, unknown>;
};
function integer(value: unknown, max = 100000): number {
  if (
    !Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max
  ) {
    throw new Error("Identificador de selección inválido.");
  }
  return Number(value);
}
function ids(value: unknown, max: number): number[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new Error("Lista inválida.");
  }
  return [...new Set(value.map((id) => integer(id)).filter(Boolean))];
}
export function parseLiveDraft(value: unknown): LiveDraftSnapshot {
  const input = object(value);
  if (
    input.version !== 1 ||
    !CLIENT_PHASES.includes(input.phase as typeof CLIENT_PHASES[number])
  ) {
    throw new Error("Versión o estado del acompañante no compatible.");
  }
  const phase = input.phase as LiveDraftSnapshot["phase"];
  // Do not retain the old draft after a dodge, disconnect or game start.
  if (phase !== "ChampSelect") {
    return {
      version: 1,
      phase,
      draftId: null,
      localCellId: null,
      mapId: null,
      queueId: null,
      gameMode: "",
      myTeam: [],
      theirTeam: [],
      bans: [],
      availableChampionIds: null,
    };
  }
  const team = (value: unknown, opponents = false): DraftSlot[] => {
    if (!Array.isArray(value) || value.length > 5) {
      throw new Error("Equipo inválido.");
    }
    const slots = value.map((entry) => {
      const slot = object(entry);
      const lockedIn = slot.lockedIn === true;
      return {
        cellId: integer(slot.cellId, 9),
        championId: opponents && !lockedIn ? 0 : integer(slot.championId),
        intentId: opponents ? 0 : integer(slot.intentId),
        role: typeof slot.role === "string" && ROLES.includes(slot.role)
          ? slot.role
          : null,
        lockedIn,
      };
    });
    if (new Set(slots.map((slot) => slot.cellId)).size !== slots.length) {
      throw new Error("Posiciones repetidas.");
    }
    return slots.sort((a, b) => a.cellId - b.cellId);
  };
  if (
    typeof input.draftId !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(input.draftId)
  ) throw new Error("Selección sin identificador.");
  const localCellId = integer(input.localCellId, 9),
    myTeam = team(input.myTeam);
  if (!myTeam.some((slot) => slot.cellId === localCellId)) {
    throw new Error("No se encontró tu posición en la selección.");
  }
  return {
    version: 1,
    phase,
    draftId: input.draftId,
    localCellId,
    mapId: input.mapId == null ? null : integer(input.mapId),
    queueId: input.queueId == null ? null : integer(input.queueId),
    gameMode: typeof input.gameMode === "string"
      ? input.gameMode.slice(0, 40)
      : "",
    myTeam,
    theirTeam: team(input.theirTeam, true),
    bans: ids(input.bans, 20),
    availableChampionIds: input.availableChampionIds == null
      ? null
      : ids(input.availableChampionIds, 1000),
  };
}
export async function bridgeTokenHash(token: string) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(
    new Uint8Array(buffer),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
