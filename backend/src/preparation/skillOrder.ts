import { and, desc, inArray, isNotNull, like } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import { matches } from "../db/schema.ts";
import type { RiotMatchTimeline } from "../riot/client.ts";

export type SkillKey = "Q" | "W" | "E" | "R";
export type SkillOrderSample = {
  sequence: SkillKey[];
  sampleGames: number;
  matchingGames: number;
  patch: string;
  source: "app-ranked-sample";
};

const SLOT_TO_SKILL: Record<number, SkillKey> = {
  1: "Q",
  2: "W",
  3: "E",
  4: "R",
};
const MIN_DISPLAY_LEVELS = 15;
const MATCH_SAMPLE_LIMIT = 500;
const CACHE_TTL_MS = 60_000;
const ROLE_IDS = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);
let cached: {
  patch: string;
  expiresAt: number;
  orders: Map<string, SkillOrderSample>;
} | null = null;
let pending: Promise<Map<string, SkillOrderSample>> | null = null;

function skillSequence(
  value: unknown,
  participantId: number,
): SkillKey[] {
  if (!value || typeof value !== "object") return [];
  const timeline = value as RiotMatchTimeline;
  const frames = timeline.info?.frames;
  if (!Array.isArray(frames)) return [];

  const events = frames.flatMap((frame) =>
    Array.isArray(frame.events) ? frame.events : []
  ).filter((event) =>
    event.type === "SKILL_LEVEL_UP" &&
    event.participantId === participantId &&
    event.levelUpType === "NORMAL" &&
    Number.isFinite(event.timestamp) &&
    SLOT_TO_SKILL[event.skillSlot ?? 0]
  ).sort((a, b) => a.timestamp - b.timestamp);

  const seen = new Set<string>();
  const sequence: SkillKey[] = [];
  for (const event of events) {
    const slot = event.skillSlot!;
    const identity = `${event.timestamp}:${slot}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    sequence.push(SLOT_TO_SKILL[slot]);
    if (sequence.length === 18) break;
  }
  return sequence;
}

function patchPrefix(version: string): string {
  return version.split(".").slice(0, 2).join(".");
}

function patchCacheKey(version: string) {
  return patchPrefix(version);
}

async function buildSampleIndex(
  currentVersion: string,
): Promise<Map<string, SkillOrderSample>> {
  const patch = patchPrefix(currentVersion);
  const rows = await db.select({
    rawDetail: matches.rawDetail,
    patchVersion: matches.patchVersion,
    rawTimeline: matches.rawTimeline,
  }).from(matches)
    .where(and(
      inArray(matches.queueId, [420, 440]),
      isNotNull(matches.rawTimeline),
      isNotNull(matches.patchVersion),
      like(matches.patchVersion, `${patch}.%`),
    ))
    .orderBy(desc(matches.gameCreation))
    .limit(MATCH_SAMPLE_LIMIT);
  const aggregate = new Map<string, {
    patch: string;
    games: number;
    paths: Map<string, { sequence: SkillKey[]; games: number }>;
  }>();
  for (const row of rows) {
    if (!row.patchVersion?.startsWith(`${patch}.`)) continue;
    const detail = row.rawDetail as {
      info?: { participants?: Array<{
        participantId?: unknown;
        championName?: unknown;
        teamPosition?: unknown;
      }> };
    } | null;
    const participants = detail?.info?.participants;
    if (!Array.isArray(participants)) continue;
    for (const participant of participants) {
      const participantId = participant.participantId;
      const champion = participant.championName;
      const role = participant.teamPosition;
      if (
        typeof participantId !== "number" || !Number.isInteger(participantId) ||
        typeof champion !== "string" || typeof role !== "string" ||
        !ROLE_IDS.has(role)
      ) continue;
      const sequence = skillSequence(row.rawTimeline, participantId);
      if (sequence.length < MIN_DISPLAY_LEVELS) continue;
      const groupKey = `${champion}\u0000${role}`;
      const group = aggregate.get(groupKey) ?? {
        patch,
        games: 0,
        paths: new Map<string, { sequence: SkillKey[]; games: number }>(),
      };
      group.games++;
      const displaySequence = sequence.slice(0, MIN_DISPLAY_LEVELS);
      const pathKey = displaySequence.join("");
      const path = group.paths.get(pathKey) ?? {
        sequence: displaySequence,
        games: 0,
      };
      path.games++;
      group.paths.set(pathKey, path);
      aggregate.set(groupKey, group);
    }
  }
  const result = new Map<string, SkillOrderSample>();
  for (const [groupKey, group] of aggregate) {
    const best = [...group.paths.values()].sort((a, b) =>
      b.games - a.games ||
      a.sequence.join("").localeCompare(b.sequence.join(""))
    )[0];
    if (!best) continue;
    result.set(groupKey, {
      sequence: best.sequence,
      sampleGames: group.games,
      matchingGames: best.games,
      patch: group.patch,
      source: "app-ranked-sample",
    });
  }
  return result;
}

async function sampleIndex(version: string) {
  const patch = patchCacheKey(version);
  if (cached?.patch === patch && cached.expiresAt > Date.now()) {
    return cached.orders;
  }
  if (pending) return await pending;
  const request = buildSampleIndex(version).then((orders) => {
    cached = { patch, expiresAt: Date.now() + CACHE_TTL_MS, orders };
    return orders;
  }).finally(() => {
    pending = null;
  });
  pending = request;
  return await request;
}

export async function getAppSkillOrder(
  champion: string,
  role: string,
  currentVersion: string,
): Promise<SkillOrderSample | null> {
  const orders = await sampleIndex(currentVersion);
  return orders.get(`${champion}\u0000${role}`) ?? null;
}
