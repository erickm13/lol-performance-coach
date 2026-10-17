import type { DraftInput } from "./preparation";
export type DraftSlot = {
  cellId: number;
  championId: number;
  intentId: number;
  role: string | null;
  lockedIn: boolean;
};
export type LiveDraftSnapshot = {
  version: 1;
  phase: string;
  draftId: string | null;
  localCellId: number | null;
  mapId: number | null;
  queueId: number | null;
  gameMode: string;
  myTeam: DraftSlot[];
  theirTeam: DraftSlot[];
  teammateTiers: string[];
  bans: number[];
  availableChampionIds: number[] | null;
  accountStatus?: "match" | "mismatch" | "unlinked" | "unverified";
};
export type LiveDraftStatus = {
  paired: boolean;
  connected: boolean;
  receivedAt: string | null;
  expiresAt: string | null;
  snapshot: LiveDraftSnapshot | null;
};
export const EMPTY_LIVE_DRAFT: LiveDraftStatus = {
  paired: false,
  connected: false,
  receivedAt: null,
  expiresAt: null,
  snapshot: null,
};
export function liveDraftInput(
  snapshot: LiveDraftSnapshot | null,
  champions: { id: string; key?: string }[],
  fallbackRole: string,
) {
  if (!snapshot || snapshot.phase !== "ChampSelect") {
    return { input: null, reason: "Esperando la selección de campeones." };
  }
  if (snapshot.mapId !== 11 || snapshot.gameMode !== "CLASSIC") {
    return {
      input: null,
      reason:
        "La guía está preparada para Grieta del Invocador en modo clásico. Esperando una selección compatible.",
    };
  }
  const byKey = new Map(
    champions.map((champion) => [Number(champion.key), champion.id]),
  );
  const me = snapshot.myTeam.find((slot) =>
    slot.cellId === snapshot.localCellId
  );
  if (!me) {
    return { input: null, reason: "Esperando tu posición en el equipo." };
  }
  const selected = snapshot.myTeam.filter((slot) =>
    slot.cellId !== me.cellId && slot.lockedIn
  ).map((slot) => slot.championId).filter(Boolean);
  const opponents = snapshot.theirTeam.filter((slot) => slot.lockedIn).map((
    slot,
  ) => slot.championId).filter(Boolean);
  const candidate = me.championId || me.intentId;
  const self = selected.includes(candidate) || opponents.includes(candidate) ||
      snapshot.bans.includes(candidate)
    ? 0
    : candidate;
  if ([...selected, ...opponents, self].some((id) => id && !byKey.has(id))) {
    return {
      input: null,
      reason:
        "Hay un campeón que aún no aparece en el catálogo de este parche. Actualiza el catálogo antes de preparar la guía.",
    };
  }
  const input: DraftInput = {
    role: me.role ?? fallbackRole,
    champion: self ? byKey.get(self) ?? null : null,
    allies: selected.map((id) => byKey.get(id)!),
    enemies: opponents.map((id) => byKey.get(id)!),
    ...(snapshot.bans.some((id) => byKey.has(id))
      ? {
        bans: snapshot.bans.flatMap((id) =>
          byKey.has(id) ? [byKey.get(id)!] : []
        ).sort(),
      }
      : {}),
    ...(snapshot.availableChampionIds !== null
      ? {
        availableChampions: snapshot.availableChampionIds.flatMap((id) =>
          byKey.has(id) ? [byKey.get(id)!] : []
        ).sort(),
      }
      : {}),
  };
  if (!input.role) {
    return {
      input: null,
      reason:
        "El cliente no asignó una línea. Elígela abajo para preparar tu guía.",
    };
  }
  if (!self && input.availableChampions?.length === 0) {
    return {
      input: null,
      reason: "Esperando que el cliente habilite tus campeones para elegir.",
    };
  }
  return {
    input,
    reason: me.lockedIn
      ? "La guía se actualiza con las selecciones confirmadas."
      : "Guía provisional: tu campeón puede cambiar hasta que lo confirmes. Solo se consideran aliados y rivales confirmados.",
  };
}
