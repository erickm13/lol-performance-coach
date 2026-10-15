"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useResource } from "../lib/useResource";
import { useDataDragon } from "../lib/useDataDragon";
import {
  duration,
  type HistoryResponse,
  matchDate,
  queueName,
} from "../lib/matches";
import { ChampionIcon } from "./ChampionIcon";
import { MatchBuild, MatchSpells } from "./MatchLoadout";
import { ScreenState } from "./ScreenState";
import { CoachIcon } from "./CoachIcon";
import { CountUp } from "./CountUp";
import { ScrollRevealRoot } from "./ScrollRevealRoot";
import { useAiChat } from "./AiChatContext";

export function MatchHistory() {
  const resultsRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState("all");
  const [queue, setQueue] = useState("all");
  const resource = useResource<HistoryResponse>(
    `/riot/matches?page=${page}&limit=10&result=${result}&queue=${queue}`,
  );
  const assets = useDataDragon();
  const { openChat } = useAiChat();
  const { data, error, loading, reload } = resource;
  const pages = data?.pagination.pages ?? 0;
  const current = data?.pagination.page ?? page;
  const numbered = Array.from(
    { length: Math.min(pages, 5) },
    (_, i) => Math.max(1, Math.min(current - 2, pages - 4)) + i,
  );
  const filtered = result !== "all" || queue !== "all";
  function goToPage(value: number) {
    setPage(value);
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }
  return (
    <ScrollRevealRoot className="screen-stack motion-page history-page">
      <header className="page-head" data-reveal="up">
        <div>
          <h2>Historial de partidas</h2>
          <p className="page-sub">
            Tu recorrido en la Grieta, partida a partida.
          </p>
        </div>
        <Link href="/dashboard" className="rune-link">← Dashboard</Link>
      </header>
      <div className="history-filters" data-reveal="up">
        <label>
          <span>Resultado</span>
          <select
            className="rune-field"
            value={result}
            onChange={(e) => {
              setResult(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos los resultados</option>
            <option value="win">Solo victorias</option>
            <option value="loss">Solo derrotas</option>
          </select>
        </label>
        <label>
          <span>Cola</span>
          <select
            className="rune-field"
            value={queue}
            onChange={(e) => {
              setQueue(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todas las colas</option>
            <option value="solo">Clasificatoria Solo/Dúo</option>
            <option value="flex">Clasificatoria Flexible</option>
            <option value="normal">Normales</option>
            <option value="aram">ARAM</option>
          </select>
        </label>
        {data && (
          <p className="page-sub">
            <CountUp value={data.pagination.total} startOnView />{" "}
            {filtered ? "partidas coinciden" : "partidas guardadas"}
          </p>
        )}
        {filtered && (
          <button
            className="btn-outline"
            type="button"
            onClick={() => {
              setResult("all");
              setQueue("all");
              setPage(1);
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>
      {data?.summary && data.linked && (
        <section
          className="history-summary section-surface"
          aria-label="Resumen de todas las partidas filtradas"
          data-reveal="up"
        >
          <header className="champ-stats-head">
            <h3>{filtered ? "Tu selección" : "Tu historial guardado"}</h3>
            <span>Todos los resultados, incluidas otras páginas</span>
          </header>
          <div className="quick-stats history-stat-grid">
            <div className="stat-tile">
              <span className="val">
                <CountUp
                  value={data.summary.winRate}
                  from={100}
                  decimals={0}
                  suffix="%"
                  startOnView
                />
              </span>
              <span className="lbl">Victorias</span>
            </div>
            <div className="stat-tile">
              <span className="val">
                <CountUp value={data.summary.wins} startOnView /> /{" "}
                <CountUp value={data.summary.losses} startOnView />
              </span>
              <span className="lbl">V / D</span>
            </div>
            <div className="stat-tile">
              <span className="val">
                {data.summary.averageKda === null ? "—" : (
                  <CountUp
                    value={data.summary.averageKda}
                    decimals={2}
                    startOnView
                  />
                )}
              </span>
              <span className="lbl">KDA promedio por partida</span>
            </div>
            <div className="stat-tile">
              <span className="val">
                {data.summary.averageCsPerMin === null ? "—" : (
                  <CountUp
                    value={data.summary.averageCsPerMin}
                    decimals={1}
                    startOnView
                  />
                )}
              </span>
              <span className="lbl">CS / min promedio</span>
            </div>
          </div>
          {data.summary.metricsCount < data.pagination.total && (
            <p className="page-sub history-summary-note">
              KDA y CS/min calculados sobre {data.summary.metricsCount}{" "}
              partidas con métricas disponibles.
            </p>
          )}
        </section>
      )}
      <div
        ref={resultsRef}
        className="history-results"
        tabIndex={-1}
        aria-busy={loading}
        role="region"
        aria-label="Resultados del historial"
      >
        {loading
          ? <ScreenState title="Cargando historial…" />
          : error
          ? (
            <ScreenState title="No pudimos cargar el historial" retry={reload}>
              {error}
            </ScreenState>
          )
          : !data?.linked
          ? (
            <ScreenState
              title="Vincula tu cuenta de Riot"
              link={{ href: "/dashboard", label: "Vincular cuenta" }}
            >
              Conecta tu cuenta para empezar a guardar tus partidas.
            </ScreenState>
          )
          : !data.matches.length
          ? (
            data.storedTotal === 0 || !filtered
              ? (
                <ScreenState
                  title="Todavía no tienes partidas guardadas"
                  link={{
                    href: "/dashboard",
                    label: "Actualizar mis partidas",
                  }}
                >
                  Sincroniza tu cuenta desde el dashboard para empezar tu
                  historial.
                </ScreenState>
              )
              : (
                <ScreenState title="Sin coincidencias con estos filtros">
                  Prueba con otra cola o resultado, o usa «Limpiar filtros» para
                  volver a tu historial completo.
                </ScreenState>
              )
          )
          : (
            <>
              <div className="history-list">
                {data.matches.map((m, index) => (
                  <article
                    key={m.match.id}
                    data-reveal="up"
                    data-reveal-delay={String(index % 3)}
                    className={`history-row ${m.win ? "win" : "loss"}`}
                  >
                    <div className="history-identity">
                      <ChampionIcon
                        champion={m.champion}
                        version={assets.version}
                        className="mini-champ"
                      />
                      <MatchSpells stats={m.rawStats} assets={assets} />
                      <div>
                        <Link
                          className="history-champion history-match-link"
                          href={`/dashboard/partida/${m.match.id}`}
                          aria-label={`Ver detalle de ${m.champion}, ${
                            m.win ? "victoria" : "derrota"
                          }, ${matchDate(m.match.gameCreation)}`}
                        >
                          {m.champion}
                        </Link>
                        <p className="history-meta">
                          {queueName(m.match.queueId)}
                        </p>
                      </div>
                    </div>
                    <MatchBuild stats={m.rawStats} assets={assets} />
                    <div className="history-score">
                      <strong className="tabular">
                        <CountUp value={m.kills} startOnView /> /{" "}
                        <CountUp value={m.deaths} startOnView /> /{" "}
                        <CountUp value={m.assists} startOnView />
                      </strong>
                      <span>
                        {m.metrics
                          ? (
                            <>
                              <CountUp
                                value={m.metrics.kda}
                                decimals={2}
                                startOnView
                              />{" "}
                              KDA ·{" "}
                              <CountUp
                                value={m.metrics.csPerMin}
                                decimals={1}
                                startOnView
                              />{" "}
                              CS/min
                            </>
                          )
                          : (
                            <>
                              <CountUp value={m.csTotal} startOnView /> CS
                            </>
                          )}
                      </span>
                    </div>
                    <div className="history-date">
                      <time dateTime={m.match.gameCreation}>
                        {matchDate(m.match.gameCreation)}
                      </time>
                      <span>{duration(m.match.gameDurationSeconds)} min</span>
                    </div>
                    <div className="history-outcome">
                      <strong className={m.win ? "text-teal" : "text-ember"}>
                        {m.win ? "Victoria" : "Derrota"}
                      </strong>
                    </div>
                    <button
                      className="history-coach btn-outline"
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
                    >
                      <CoachIcon />
                      <span>Analizar</span>
                    </button>
                  </article>
                ))}
              </div>
              <nav
                className="history-pagination"
                aria-label="Páginas del historial"
              >
                <button
                  className="btn-outline"
                  disabled={current <= 1}
                  onClick={() => goToPage(current - 1)}
                >
                  ← Anterior
                </button>
                {numbered.map((n) => (
                  <button
                    key={n}
                    className={`btn-outline${n === current ? " active" : ""}`}
                    aria-current={n === current ? "page" : undefined}
                    onClick={() => goToPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="btn-outline"
                  disabled={current >= pages}
                  onClick={() => goToPage(current + 1)}
                >
                  Siguiente →
                </button>
                <span className="history-page-label">
                  Página {current} de {pages}
                </span>
              </nav>
            </>
          )}
      </div>
    </ScrollRevealRoot>
  );
}
