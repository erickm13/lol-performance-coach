"use client";
import Link from "next/link";
import { useResource } from "../lib/useResource";
import { useDataDragon } from "../lib/useDataDragon";
import {
  duration,
  matchDate,
  type MatchDetail,
  queueName,
} from "../lib/matches";
import { ChampionIcon } from "./ChampionIcon";
import { MatchBuild, MatchSpells } from "./MatchLoadout";
import { ScreenState } from "./ScreenState";
import { useAiChat } from "./AiChatContext";
import { CoachIcon } from "./CoachIcon";
import { MatchEventMap } from "./MatchEventMap";
import { MatchReviewProvider } from "./MatchReviewContext";
import { MatchCoachSummary } from "./MatchCoachSummary";
import { MatchSectionNav } from "./MatchSectionNav";
import { CountUp } from "./CountUp";
import { ScrollRevealRoot } from "./ScrollRevealRoot";
import { AnimatedDamageBar } from "./AnimatedDamageBar";
const ROLES: Record<string, string> = {
  TOP: "Superior",
  JUNGLE: "Jungla",
  MIDDLE: "Central",
  BOTTOM: "Inferior",
  UTILITY: "Soporte",
};

function MatchKda(
  { kills, deaths, assists, className }: {
    kills: number;
    deaths: number;
    assists: number;
    className: string;
  },
) {
  return (
    <span className={`match-kda tabular ${className}`}>
      {[
        { label: "K", name: "Asesinatos", value: kills },
        { label: "D", name: "Muertes", value: deaths },
        { label: "A", name: "Asistencias", value: assists },
      ].map((stat, index) => (
        <span key={stat.label} className="detail-kda-part">
          {index > 0 && <span className="kda-sep" aria-hidden="true">/</span>}
          <span className="kda-stat" title={stat.name}>
            <span className="kda-label">{stat.label}</span>
            <span className="kda-num">
              <CountUp
                value={stat.value}
                startOnView
                durationMs={1200}
                delayMs={index * 70}
              />
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

export function MatchDetailView({ matchId }: { matchId: string }) {
  const { data, loading, error, reload } = useResource<MatchDetail>(
    `/riot/matches/${encodeURIComponent(matchId)}`,
  );
  const assets = useDataDragon();
  const { openChat } = useAiChat();
  if (loading) {
    return (
      <ScreenState title="Cargando detalle de partida…">
        La primera consulta puede tardar mientras recuperamos los equipos y
        eventos de Riot.
      </ScreenState>
    );
  }
  if (error || !data) {
    return (
      <ScreenState
        title="No pudimos abrir la partida"
        retry={reload}
        link={{ href: "/dashboard/historial", label: "Volver al historial" }}
      >
        {error}
      </ScreenState>
    );
  }
  const p = data.participant;
  const metrics = data.metrics;
  const stats = [
    { label: "CS / min", value: metrics?.csPerMin, decimals: 1 },
    { label: "KDA", value: metrics?.kda, decimals: 2 },
    { label: "Visión / min", value: metrics?.visionScorePerMin, decimals: 2 },
    { label: "Oro / min", value: metrics?.goldPerMin, decimals: 0 },
    {
      label: "Participación en kills",
      value: metrics ? Math.round(metrics.killParticipation * 100) : undefined,
      suffix: "%",
      from: 100,
    },
  ];
  const teamIds = Array.from(
    new Set(data.participants.map((player) => player.teamId)),
  ).sort((a, b) => a - b);
  return (
    <MatchReviewProvider
      key={matchId}
      matchId={matchId}
      events={data.events}
      teamId={p.teamId}
      durationSeconds={data.match.gameDurationSeconds}
      enabled={data.timelineAvailable && data.mapId === 11}
    >
      <ScrollRevealRoot className="screen-stack match-detail-page">
        <Link className="rune-link" href="/dashboard/historial">
          ← Volver al historial
        </Link>
        <MatchSectionNav />
        <div
          id="match-overview"
          className="screen-stack match-review-section"
          role="region"
          aria-label="Resumen de la partida"
          tabIndex={-1}
        >
          <section
            className={`detail-header ${p.win ? "win" : "loss"}`}
            data-reveal="fade"
          >
            <div className="detail-identity" data-reveal="left">
              <ChampionIcon
                champion={p.champion}
                version={assets.version}
                className="mini-champ"
              />
              <div>
                <span className="teaser-label">Detalle de partida</span>
                <h2 className={p.win ? "text-teal" : "text-ember"}>
                  {p.win ? "Victoria" : "Derrota"} <span>· {p.champion}</span>
                </h2>
                <p className="page-sub">
                  {queueName(data.match.queueId)} ·{" "}
                  {duration(data.match.gameDurationSeconds)} min ·{" "}
                  {matchDate(data.match.gameCreation)}
                </p>
                <small className="text-mist">
                  {data.match.riotMatchId} · Parche{" "}
                  {data.match.patchVersion ?? "sin datos"}
                </small>
              </div>
            </div>
            <div
              className="detail-actions"
              data-reveal="right"
              data-reveal-delay="1"
            >
              <MatchKda
                className="detail-kda"
                kills={p.kills}
                deaths={p.deaths}
                assists={p.assists}
              />
              <button
                className="rune-btn history-coach"
                onClick={() =>
                  openChat("match", {
                    champion: p.champion,
                    win: p.win,
                    kills: p.kills,
                    deaths: p.deaths,
                    assists: p.assists,
                    csPerMin: metrics?.csPerMin,
                    kda: metrics?.kda,
                  })}
              >
                <CoachIcon />Analizar con el coach
              </button>
            </div>
            <div
              className="detail-loadout"
              data-reveal="up"
              data-reveal-delay="2"
            >
              <MatchSpells stats={p.rawStats} assets={assets} />
              <MatchBuild stats={p.rawStats} assets={assets} />
              <span>
                <CountUp value={p.csTotal} startOnView /> CS ·{" "}
                <CountUp value={p.visionScore} startOnView /> visión ·{" "}
                <CountUp value={p.goldTotal} startOnView useGrouping /> oro
              </span>
            </div>
          </section>
          {data.warning && (
            <div className="screen-notice" role="status" data-reveal="up">
              <p>{data.warning}</p>
              <button className="rune-link" onClick={reload}>
                Reintentar detalle
              </button>
            </div>
          )}
          <div className="quick-stats detail-stat-grid" data-reveal="scale">
            {stats.map((stat, index) => (
              <div
                className="stat-tile"
                key={stat.label}
                data-reveal="up"
                data-reveal-delay={String(index % 3)}
              >
                <span className="val tabular">
                  {stat.value === undefined ? "—" : (
                    <CountUp
                      value={stat.value}
                      decimals={stat.decimals ?? 0}
                      suffix={stat.suffix ?? ""}
                      from={stat.from ?? 0}
                      startOnView
                    />
                  )}
                </span>
                <span className="lbl">{stat.label}</span>
              </div>
            ))}
          </div>
          <MatchCoachSummary />
        </div>
        <div
          id="match-teams"
          className="detail-teams match-review-section"
          role="region"
          aria-label="Equipos de la partida"
          tabIndex={-1}
        >
          {teamIds.map((id) => {
            const team = data.participants.filter((player) =>
              player.teamId === id
            );
            const totalDamage = Math.max(
              1,
              ...team.map((player) => player.damageTotal),
            );
            return (
              <section
                key={id}
                className={`detail-team ${id === 100 ? "blue" : "red"}`}
                data-reveal={id === 100 ? "left" : "right"}
              >
                <header className="champ-stats-head">
                  <h3>
                    {id === 100
                      ? "Equipo azul"
                      : id === 200
                      ? "Equipo rojo"
                      : `Equipo ${id}`}
                  </h3>
                  {data.detailAvailable && (
                    <span className={team[0]?.win ? "text-teal" : "text-ember"}>
                      {team[0]?.win ? "Victoria" : "Derrota"} ·{" "}
                      <CountUp
                        value={team.reduce((sum, player) =>
                          sum + player.kills, 0)}
                        startOnView
                      />{" "}
                      kills
                    </span>
                  )}
                </header>
                <div className="team-column-labels">
                  <span>Jugador / objetos</span>
                  <span>K / D / A</span>
                  <span>Daño / CS</span>
                </div>
                {team.map((player, index) => (
                  <div
                    key={index}
                    className={`detail-player${player.isSelf ? " self" : ""}`}
                    data-reveal="up"
                    data-reveal-delay={String(index % 3)}
                  >
                    <div className="team-player-info">
                      <ChampionIcon
                        champion={player.champion}
                        version={assets.version}
                        className="champ-icon-sm"
                      />
                      <div>
                        <strong>
                          {player.summonerName}{" "}
                          {player.isSelf && (
                            <span className="self-label">Tú</span>
                          )}
                        </strong>
                        <small>
                          {player.champion} ·{" "}
                          {ROLES[player.role ?? ""] ?? player.role ?? "Sin rol"}
                        </small>
                        <MatchBuild stats={player.rawStats} assets={assets} />
                      </div>
                    </div>
                    <MatchKda
                      className="team-kda"
                      kills={player.kills}
                      deaths={player.deaths}
                      assists={player.assists}
                    />
                    <div className="team-damage">
                      <span>
                        <CountUp
                          value={player.damageTotal}
                          startOnView
                          useGrouping
                          durationMs={1200}
                          delayMs={180}
                        />
                      </span>
                      <AnimatedDamageBar
                        value={player.damageTotal / totalDamage * 100}
                      />
                      <small>
                        <CountUp
                          value={player.csTotal}
                          startOnView
                          durationMs={1200}
                          delayMs={180}
                        />{" "}
                        CS
                      </small>
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
        <section
          id="match-map"
          className="rift-card match-map-card match-review-section"
          aria-labelledby="match-map-heading"
          tabIndex={-1}
        >
          <header data-reveal="up">
            <h3 id="match-map-heading">Mapa de tu partida</h3>
            <p className="page-sub">
              {p.champion} · {queueName(data.match.queueId)} ·{" "}
              {p.win ? "Victoria" : "Derrota"} ·{" "}
              {duration(data.match.gameDurationSeconds)}{" "}
              min — pasa el cursor para explorar o selecciona un punto para
              fijar su análisis.
            </p>
          </header>
          {!data.timelineAvailable
            ? (
              <p className="page-sub">
                No pudimos recuperar el timeline de esta partida.
              </p>
            )
            : data.mapId !== 11
            ? (
              <p className="page-sub">
                El mapa interactivo está disponible para partidas de la Grieta
                del Invocador.
              </p>
            )
            : (
              <>
                <MatchEventMap />
              </>
            )}
        </section>
      </ScrollRevealRoot>
    </MatchReviewProvider>
  );
}
