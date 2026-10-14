"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBackendUrl } from "../lib/api";
import { useAiChat } from "./AiChatContext";

const DDRAGON_VERSION = "14.18.1";

function championIconUrl(champion: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${champion}.png`;
}

type MatchRow = {
  id: string;
  champion: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  match: { id: string; gameDurationSeconds: number; queueId: number | null };
  metrics: { csPerMin: number; kda: number } | null;
};

type HistoryResponse = {
  matches: MatchRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const QUEUE_OPTIONS = [
  { value: "", label: "Todas las colas" },
  { value: "420", label: "Clasificatoria Solo/Dúo" },
  { value: "400", label: "Normales" },
];

export function MatchHistory() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState("");
  const [queue, setQueue] = useState("");
  const [page, setPage] = useState(1);
  const { openChat } = useAiChat();

  useEffect(() => {
    setLoaded(false);
    const params = new URLSearchParams();
    if (result) params.set("result", result);
    if (queue) params.set("queue", queue);
    params.set("page", String(page));

    fetch(`${getBackendUrl()}/riot/matches?${params.toString()}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [result, queue, page]);

  function handleFilterChange(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="rune-stagger flex flex-col gap-6 w-full max-w-3xl">
      <h1 className="font-display text-xl font-semibold">Historial de partidas</h1>

      <div className="flex gap-3 flex-wrap">
        <select
          value={result}
          onChange={(e) => handleFilterChange(setResult, e.target.value)}
          className="rune-field text-sm w-auto"
        >
          <option value="">Todos los resultados</option>
          <option value="win">Solo victorias</option>
          <option value="loss">Solo derrotas</option>
        </select>
        <select
          value={queue}
          onChange={(e) => handleFilterChange(setQueue, e.target.value)}
          className="rune-field text-sm w-auto"
        >
          {QUEUE_OPTIONS.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </select>
      </div>

      {!loaded && <p className="text-mist">Cargando...</p>}

      {loaded && data && data.matches.length === 0 && (
        <p className="text-mist text-sm">No encontramos partidas con esos filtros.</p>
      )}

      <div className="flex flex-col gap-3">
        {data?.matches.map((m) => (
          <div
            key={m.id}
            className={`rune-panel p-4 flex items-center justify-between gap-4 flex-wrap border-l-4 ${
              m.win ? "border-l-teal" : "border-l-ember"
            }`}
          >
            <Link href={`/dashboard/partida/${m.match.id}`} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={championIconUrl(m.champion)}
                alt={m.champion}
                className="h-10 w-10"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
              <span className="font-medium">{m.champion}</span>
            </Link>
            <span className="text-mist">
              {m.kills}/{m.deaths}/{m.assists}
            </span>
            <span className="text-mist text-sm">
              {Math.round(m.match.gameDurationSeconds / 60)} min
            </span>
            <span className={m.win ? "text-teal" : "text-ember"}>
              {m.win ? "Victoria" : "Derrota"}
            </span>
            <button
              onClick={() =>
                openChat("match", {
                  champion: m.champion,
                  win: m.win,
                  kills: m.kills,
                  deaths: m.deaths,
                  assists: m.assists,
                  csPerMin: m.metrics?.csPerMin,
                  kda: m.metrics?.kda,
                })}
              aria-label="Analizar con IA"
              title="Analizar con IA"
              className="text-teal text-sm border border-teal/40 px-2 py-1 hover:bg-teal/10 transition-colors"
            >
              ✨
            </button>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rune-field text-sm px-3 py-1 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-mist text-sm">
            Página {data.page} de {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="rune-field text-sm px-3 py-1 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
