"use client";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { MatchEvent } from "../lib/matches";
import { useMatchInsights } from "../lib/useMatchInsights";

export type ReviewFilter = "all" | "highlights" | "mistake" | "good";
export type ReviewPhase = "all" | "early" | "mid" | "late";
export function inReviewPhase(timestamp: number, phase: ReviewPhase) {
  if (phase === "early") return timestamp < 10 * 60000;
  if (phase === "mid") return timestamp >= 10 * 60000 && timestamp < 20 * 60000;
  if (phase === "late") return timestamp >= 20 * 60000;
  return true;
}

type MatchReviewState = ReturnType<typeof useMatchInsights> & {
  events: MatchEvent[];
  teamId: number;
  durationSeconds: number;
  enabled: boolean;
  filter: ReviewFilter;
  setFilter: (filter: ReviewFilter) => void;
  phase: ReviewPhase;
  setPhase: (phase: ReviewPhase) => void;
  selected: number | null;
  setSelected: (index: number | null) => void;
  focusEvent: (index: number) => void;
};
const MatchReviewContext = createContext<MatchReviewState | null>(null);

export function MatchReviewProvider(
  { matchId, events, teamId, durationSeconds, enabled, children }: {
    matchId: string;
    events: MatchEvent[];
    teamId: number;
    durationSeconds: number;
    enabled: boolean;
    children: ReactNode;
  },
) {
  const [filter, changeFilter] = useState<ReviewFilter>("all");
  const [phase, changePhase] = useState<ReviewPhase>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const analysis = useMatchInsights(matchId, filter, enabled);
  return (
    <MatchReviewContext.Provider
      value={{
        ...analysis,
        events,
        teamId,
        durationSeconds,
        enabled,
        filter,
        phase,
        selected,
        setSelected,
        setFilter: (value) => {
          changeFilter(value);
          setSelected(null);
        },
        setPhase: (value) => {
          changePhase(value);
          setSelected(null);
        },
        focusEvent: (index) => {
          if (!events[index]) return;
          changeFilter("all");
          changePhase("all");
          setSelected(index);
          const map = document.getElementById("match-map");
          window.history.replaceState(null, "", "#match-map");
          map?.focus({ preventScroll: true });
          map?.scrollIntoView({
            behavior:
              window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            block: "start",
          });
        },
      }}
    >
      {children}
    </MatchReviewContext.Provider>
  );
}

export function useMatchReview() {
  const context = useContext(MatchReviewContext);
  if (!context) {
    throw new Error("El análisis de partida requiere MatchReviewProvider");
  }
  return context;
}
