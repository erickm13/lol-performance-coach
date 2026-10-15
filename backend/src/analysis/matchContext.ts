import type {
  RiotMatchParticipant,
  RiotMatchTimeline,
  RiotParticipantFrame,
  RiotTimelineEvent,
} from "../riot/client.ts";

export type MomentContext = {
  killer: string | null;
  victim: string | null;
  assistants: string[];
  scoreBefore: { kills: number; deaths: number; assists: number };
  snapshot: {
    timestamp: number;
    ageSeconds: number;
    self: {
      position: { x: number; y: number } | null;
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
    nearbyAvailable: boolean;
    nearby: {
      position: { x: number; y: number };
      champion: string;
      side: "ally" | "enemy";
      distance: number;
      level: number | null;
    }[];
  } | null;
  recentPurchases: { secondsBefore: number; itemId: number }[];
  wardsLast120s: { selfPlaced: number; teamPlaced: number; teamKilled: number };
  nearbyKills: {
    secondsFromEvent: number;
    killer: string | null;
    victim: string | null;
    victimSide: "ally" | "enemy" | "unknown";
  }[];
  objectives: {
    position: { x: number; y: number } | null;
    secondsFromEvent: number;
    type: string;
    monster: string | null;
    building: string | null;
    killerTeamId: number | null;
    structureTeamId: number | null;
  }[];
};
const finite = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
function position(point?: { x: number; y: number }) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y)
    ? { x: point.x, y: point.y }
    : null;
}
function cs(frame: RiotParticipantFrame | undefined) {
  return frame && finite(frame.minionsKilled) !== null &&
      finite(frame.jungleMinionsKilled) !== null
    ? frame.minionsKilled! + frame.jungleMinionsKilled!
    : null;
}
export function buildMomentContext(
  timeline: RiotMatchTimeline,
  event: RiotTimelineEvent,
  self: RiotMatchParticipant,
  participants: RiotMatchParticipant[],
  allEvents: RiotTimelineEvent[],
): MomentContext {
  const byId = new Map(
    participants.map((player) => [player.participantId, player]),
  );
  const champion = (id?: number) =>
    id ? byId.get(id)?.championName ?? null : null;
  const before = allEvents.filter((candidate) =>
    candidate.timestamp < event.timestamp
  );
  const recent = before.filter((candidate) =>
    candidate.timestamp >= event.timestamp - 120000
  );
  const scoreBefore = { kills: 0, deaths: 0, assists: 0 };
  for (const candidate of before) {
    if (candidate.type !== "CHAMPION_KILL") continue;
    if (candidate.killerId === self.participantId) scoreBefore.kills++;
    if (candidate.victimId === self.participantId) scoreBefore.deaths++;
    if (candidate.assistingParticipantIds?.includes(self.participantId)) {
      scoreBefore.assists++;
    }
  }
  // Only a preceding snapshot is used. Its age travels with every observation.
  const frame =
    timeline.info.frames.filter((candidate) =>
      typeof candidate.timestamp === "number" &&
      candidate.timestamp <= event.timestamp && candidate.participantFrames
    )
      .sort((a, b) => b.timestamp! - a.timestamp!)[0];
  const age = frame?.timestamp === undefined
    ? Infinity
    : (event.timestamp - frame.timestamp) / 1000;
  const ownFrame = frame?.participantFrames?.[String(self.participantId)];
  let snapshot: MomentContext["snapshot"] = null;
  if (frame && ownFrame && age <= 90) {
    const opponent = self.teamPosition
      ? participants.find((p) =>
        p.teamId !== self.teamId && p.teamPosition === self.teamPosition
      )
      : undefined;
    const opponentFrame = opponent
      ? frame.participantFrames?.[String(opponent.participantId)]
      : undefined;
    const ownCs = cs(ownFrame), enemyCs = cs(opponentFrame);
    const ownGold = finite(ownFrame.totalGold),
      enemyGold = finite(opponentFrame?.totalGold);
    const health = finite(ownFrame.championStats?.health),
      healthMax = finite(ownFrame.championStats?.healthMax);
    snapshot = {
      timestamp: frame.timestamp!,
      ageSeconds: Math.round(age),
      self: {
        position: position(ownFrame.position),
        level: finite(ownFrame.level),
        totalGold: ownGold,
        unspentGold: finite(ownFrame.currentGold),
        cs: ownCs,
        healthPercent: health !== null && healthMax !== null && healthMax > 0
          ? Math.round(100 * health / healthMax)
          : null,
      },
      opponentByRole: opponent && opponentFrame
        ? {
          champion: opponent.championName,
          level: finite(opponentFrame.level),
          goldDifference: ownGold !== null && enemyGold !== null
            ? ownGold - enemyGold
            : null,
          csDifference: ownCs !== null && enemyCs !== null
            ? ownCs - enemyCs
            : null,
        }
        : null,
      // Positions a minute old should never be presented as a live headcount.
      nearbyAvailable: age <= 30 && Boolean(ownFrame.position),
      nearby: age <= 30 && ownFrame.position
        ? participants.filter((p) => p.participantId !== self.participantId)
          .flatMap((p) => {
            const state = frame.participantFrames?.[String(p.participantId)];
            const nearbyPosition = position(state?.position);
            if (!nearbyPosition || state?.championStats?.health === 0) {
              return [];
            }
            const distance = Math.round(
              Math.hypot(
                nearbyPosition.x - ownFrame.position!.x,
                nearbyPosition.y - ownFrame.position!.y,
              ),
            );
            return distance <= 2000
              ? [{
                position: nearbyPosition,
                champion: p.championName,
                side: p.teamId === self.teamId
                  ? "ally" as const
                  : "enemy" as const,
                distance,
                level: finite(state?.level),
              }]
              : [];
          }).sort((a, b) => a.distance - b.distance).slice(0, 6)
        : [],
    };
  }
  return {
    killer: champion(event.killerId),
    victim: champion(event.victimId),
    assistants: (event.assistingParticipantIds ?? []).flatMap((id) =>
      champion(id) ? [champion(id)!] : []
    ),
    scoreBefore,
    snapshot,
    recentPurchases: recent.filter((candidate) =>
      candidate.type === "ITEM_PURCHASED" &&
      candidate.participantId === self.participantId &&
      typeof candidate.itemId === "number"
    )
      .slice(-6).map((candidate) => ({
        secondsBefore: Math.round(
          (event.timestamp - candidate.timestamp) / 1000,
        ),
        itemId: candidate.itemId!,
      })),
    wardsLast120s: {
      selfPlaced:
        recent.filter((e) =>
          e.type === "WARD_PLACED" && e.creatorId === self.participantId
        ).length,
      teamPlaced: recent.filter((e) =>
        e.type === "WARD_PLACED" &&
        byId.get(e.creatorId ?? -1)?.teamId === self.teamId
      ).length,
      teamKilled: recent.filter((e) =>
        e.type === "WARD_KILL" &&
        byId.get(e.killerId ?? -1)?.teamId === self.teamId
      ).length,
    },
    nearbyKills: allEvents.filter((e) =>
      e !== event && e.type === "CHAMPION_KILL" &&
      Math.abs(e.timestamp - event.timestamp) <= 15000 && e.position &&
      event.position &&
      Math.hypot(
          e.position.x - event.position.x,
          e.position.y - event.position.y,
        ) <= 2000
    ).slice(0, 6)
      .map((e) => ({
        secondsFromEvent: Math.round((e.timestamp - event.timestamp) / 1000),
        killer: champion(e.killerId),
        victim: champion(e.victimId),
        victimSide: !byId.get(e.victimId ?? -1)
          ? "unknown"
          : byId.get(e.victimId!)!.teamId === self.teamId
          ? "ally"
          : "enemy",
      })),
    objectives: allEvents.filter((e) =>
      ["ELITE_MONSTER_KILL", "BUILDING_KILL"].includes(e.type) &&
      e.timestamp >= event.timestamp - 90000 &&
      e.timestamp <= event.timestamp + 30000
    ).slice(-4)
      .map((e) => ({
        position: position(e.position),
        secondsFromEvent: Math.round((e.timestamp - event.timestamp) / 1000),
        type: e.type,
        monster: e.monsterSubType ?? e.monsterType ?? null,
        building: e.towerType ?? e.buildingType ?? null,
        killerTeamId: e.killerTeamId ?? byId.get(e.killerId ?? -1)?.teamId ??
          null,
        structureTeamId: e.type === "BUILDING_KILL" ? e.teamId ?? null : null,
      })),
  };
}
