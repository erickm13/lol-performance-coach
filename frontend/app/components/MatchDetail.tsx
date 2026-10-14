"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBackendUrl } from "../lib/api";
import { useAiChat } from "./AiChatContext";

const DDRAGON_VERSION = "14.18.1";

function championIconUrl(champion: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${champion}.png`;
}

type Participant = {
  id: string;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  teamId: number;
};

type MatchDetailResponse = {
  match: { gameDurationSeconds: number; gameCreation: string; queueId: number | null };
  own: Participant & {
    metrics: {
      csPerMin: number;
      kda: number;
      visionScorePerMin: number;
      goldPerMin: number;
      killParticipation: number;
    } | null;
  };
  teams: { blue: Participant[]; red: Participant[] };
};

export function MatchDetail({ matchId }: { matchId: string }) {
  const [data, setData] = useState<MatchDetailResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const { openChat } = useAiChat();

  useEffect(() => {
    fetch(`${getBackendUrl()}/riot/matches/${matchId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((d) => d && setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoaded(true));
  }, [matchId]);

  if (!loaded) {
    return <p className="text-mist">Cargando...</p>;
  }

  if (notFound || !data) {
    return <p className="text-mist text-sm">No encontramos esa partida.</p>;
  }

  const { own, match, teams } = data;

  return (
    <div className="rune-stagger flex flex-col gap-6 w-full max-w-3xl">
      <Link href="/dashboard/historial" className="rune-link text-sm">
        ← Volver al historial
      </Link>

      <section className="rune-panel p-6 flex items-center justify-between gap-5 flex-wrap">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={championIconUrl(own.champion)}
            alt={own.champion}
            className="h-14 w-14"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
          <div>
            <p className={`font-display font-semibold ${own.win ? "text-teal" : "text-ember"}`}>
              {own.win ? "Victoria" : "Derrota"}
            </p>
            <p className="text-mist text-sm">
              {own.champion} · {Math.round(match.gameDurationSeconds / 60)} min
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="font-display text-xl">
            {own.kills} / {own.deaths} / {own.assists}
          </span>
          <button
            onClick={() =>
              openChat("match", {
                champion: own.champion,
                win: own.win,
                kills: own.kills,
                deaths: own.deaths,
                assists: own.assists,
                csPerMin: own.metrics?.csPerMin,
                kda: own.metrics?.kda,
              })}
            className="text-teal text-sm border border-teal/40 px-3 py-1.5 hover:bg-teal/10 transition-colors"
          >
            ✨ Analizar con IA
          </button>
        </div>
      </section>

      {own.metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 border border-panel-line divide-x divide-panel-line">
          <div className="p-4 flex flex-col gap-1">
            <span className="font-display text-lg">{own.metrics.csPerMin.toFixed(1)}</span>
            <span className="text-mist text-xs">CS / min</span>
          </div>
          <div className="p-4 flex flex-col gap-1">
            <span className="font-display text-lg">{own.metrics.kda.toFixed(2)}</span>
            <span className="text-mist text-xs">KDA</span>
          </div>
          <div className="p-4 flex flex-col gap-1">
            <span className="font-display text-lg">
              {own.metrics.visionScorePerMin.toFixed(2)}
            </span>
            <span className="text-mist text-xs">Visión / min</span>
          </div>
          <div className="p-4 flex flex-col gap-1">
            <span className="font-display text-lg">{Math.round(own.metrics.goldPerMin)}</span>
            <span className="text-mist text-xs">Oro / min</span>
          </div>
          <div className="p-4 flex flex-col gap-1">
            <span className="font-display text-lg">
              {Math.round(own.metrics.killParticipation * 100)}%
            </span>
            <span className="text-mist text-xs">Participación en kills</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rune-panel p-4">
          <h3 className="text-teal text-xs uppercase tracking-wide mb-3">Equipo azul</h3>
          {teams.blue.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between py-1.5 text-sm border-t border-panel-line first:border-t-0 ${
                p.id === own.id ? "text-parchment font-semibold" : "text-mist"
              }`}
            >
              <span>
                {p.champion}
                {p.id === own.id ? " (vos)" : ""}
              </span>
              <span>
                {p.kills}/{p.deaths}/{p.assists}
              </span>
            </div>
          ))}
        </section>
        <section className="rune-panel p-4">
          <h3 className="text-ember text-xs uppercase tracking-wide mb-3">Equipo rojo</h3>
          {teams.red.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between py-1.5 text-sm border-t border-panel-line first:border-t-0 ${
                p.id === own.id ? "text-parchment font-semibold" : "text-mist"
              }`}
            >
              <span>
                {p.champion}
                {p.id === own.id ? " (vos)" : ""}
              </span>
              <span>
                {p.kills}/{p.deaths}/{p.assists}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
