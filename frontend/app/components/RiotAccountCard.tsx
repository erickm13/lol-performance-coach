"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getBackendUrl } from "../lib/api";
import { useAiChat } from "./AiChatContext";
import { CountUp } from "./CountUp";
import { ChampionIcon } from "./ChampionIcon";
import { CoachIcon } from "./CoachIcon";
import { ItemIcon } from "./ItemIcon";
import { SummonerSpellIcon } from "./SummonerSpellIcon";
import { RankEmblem } from "./RankEmblem";
import { Tooltip } from "./Tooltip";
import { DEFAULT_DDRAGON_VERSION, loadItemCatalog, loadSummonerSpellCatalog, type ItemCatalog, type SummonerSpellCatalog } from "../lib/dataDragon";

const TIER_LABELS: Record<string, string> = {
  IRON: "Hierro",
  BRONZE: "Bronce",
  SILVER: "Plata",
  GOLD: "Oro",
  PLATINUM: "Platino",
  EMERALD: "Esmeralda",
  DIAMOND: "Diamante",
  MASTER: "Maestro",
  GRANDMASTER: "Gran Maestro",
  CHALLENGER: "Retador",
};

type RawParticipant = {
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  summoner1Id: number;
  summoner2Id: number;
};

type MatchMetrics = {
  csPerMin: number;
  kda: number;
};

type Match = {
  match?: { id: string };
  champion: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  rawStats: RawParticipant;
  metrics: MatchMetrics | null;
};

type ChampionStat = {
  champion: string;
  games: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgKda: number;
};

type Teammate = {
  puuid: string;
  summonerName: string;
  profileIconId: number | null;
  soloTier: string | null;
  games: number;
  wins: number;
  winRate: number;
};

type RiotAccount = {
  summonerName: string;
  tagLine: string;
  region: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  soloTier: string | null;
  soloRank: string | null;
  soloLp: number | null;
  soloWins: number | null;
  soloLosses: number | null;
};

function computeQuickStats(matches: Match[]) {
  if (matches.length === 0) return null;
  const withMetrics = matches.filter((m) => m.metrics);
  const kdaAvg = withMetrics.length > 0
    ? withMetrics.reduce((sum, m) => sum + m.metrics!.kda, 0) /
      withMetrics.length
    : 0;
  const csAvg = withMetrics.length > 0
    ? withMetrics.reduce((sum, m) => sum + m.metrics!.csPerMin, 0) /
      withMetrics.length
    : 0;
  const wins = matches.filter((m) => m.win).length;
  const winRate = Math.round((wins / matches.length) * 100);
  return { kdaAvg, csAvg, winRate, gamesAnalyzed: matches.length, metricGames: withMetrics.length };
}

export function RiotAccountCard({ emailVerified }: { emailVerified: boolean }) {
  const [account, setAccount] = useState<RiotAccount | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [championStats, setChampionStats] = useState<ChampionStat[]>([]);
  const [recentTeammates, setRecentTeammates] = useState<Teammate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ddragonVersion, setDdragonVersion] = useState(DEFAULT_DDRAGON_VERSION);
  const [itemCatalog, setItemCatalog] = useState<ItemCatalog>({});
  const [itemsLoading, setItemsLoading] = useState(true);
  const [spellCatalog, setSpellCatalog] = useState<SummonerSpellCatalog>({});
  const [spellsLoading, setSpellsLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<{ kind: "error" | "warning"; text: string } | null>(null);
  const { openChat } = useAiChat();

  // Mantiene la versión de Data Dragon al día para que no falten íconos/ítems nuevos.
  useEffect(() => {
    let active = true;
    fetch("https://ddragon.leagueoflegends.com/api/versions.json")
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo consultar la versión de Data Dragon");
        return r.json();
      })
      .then((versions: string[]) => {
        if (active && Array.isArray(versions) && /^\d+\.\d+\.\d+$/.test(versions[0])) {
          setDdragonVersion(versions[0]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setItemCatalog({});
    setItemsLoading(true);
    loadItemCatalog(ddragonVersion)
      .then((catalog) => { if (active) setItemCatalog(catalog); })
      .catch(() => { /* El dashboard sigue disponible si falla el catálogo. */ })
      .finally(() => { if (active) setItemsLoading(false); });
    setSpellCatalog({});
    setSpellsLoading(true);
    loadSummonerSpellCatalog(ddragonVersion)
      .then((catalog) => { if (active) setSpellCatalog(catalog); })
      .catch(() => { /* Los íconos conocidos se conservan aunque falle el catálogo. */ })
      .finally(() => { if (active) setSpellsLoading(false); });
    return () => { active = false; };
  }, [ddragonVersion]);

  async function loadAccount() {
    try {
      const res = await fetch(`${getBackendUrl()}/riot/account`, {
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = await res.json();
      setAccount(data.account);
      setMatches(data.matches ?? []);
      setChampionStats(data.championStats ?? []);
      setRecentTeammates(data.recentTeammates ?? []);
      setLastSyncedAt(data.lastSyncedAt ?? null);
      return true;
    } catch {
      return false;
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    loadAccount();
  }, []);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLinking(true);
    try {
      const res = await fetch(`${getBackendUrl()}/riot/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gameName, tagLine }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "No se pudo vincular la cuenta");
        return;
      }

      await loadAccount();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLinking(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await fetch(`${getBackendUrl()}/riot/sync`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncNotice({ kind: "error", text: data.error ?? "No se pudieron actualizar las partidas." });
        return;
      }
      const reloaded = await loadAccount();
      if (!reloaded) {
        setSyncNotice({ kind: "error", text: "La actualización terminó, pero no pudimos recargar los datos. Intenta de nuevo." });
      } else if (data.partial) {
        setSyncNotice({ kind: "warning", text: "Actualización parcial: algunas partidas no se pudieron descargar. Se conserva la fecha de la última sincronización completa." });
      }
    } catch {
      setSyncNotice({ kind: "error", text: "No se pudo conectar con el servidor. Intenta de nuevo." });
    } finally {
      setSyncing(false);
    }
  }

  if (!loaded) {
    return (
      <section className="rune-panel p-6">
        <p className="text-mist">Cargando tu cuenta de Riot...</p>
      </section>
    );
  }

  if (!account) {
    return (
      <div className="rune-stagger flex flex-col gap-8">
        <section className="rune-panel p-6">
          <h2 className="font-display text-lg font-semibold mb-4">
            Vincular tu cuenta de Riot
          </h2>
          <form onSubmit={handleLink} className="flex flex-col gap-4 max-w-sm">
            {error && (
              <p role="alert" className="text-ember text-sm">
                {error}
              </p>
            )}
            <label className="flex flex-col gap-1.5 text-sm text-mist">
              Nombre de invocador
              <input
                required
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="TP Salchipapa"
                className="rune-field text-parchment text-base"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-mist">
              Tag
              <input
                required
                value={tagLine}
                onChange={(e) => setTagLine(e.target.value)}
                placeholder="3192"
                className="rune-field text-parchment text-base"
              />
            </label>
            <button
              type="submit"
              disabled={linking}
              className="rune-btn self-start"
            >
              {linking ? "Buscando tus partidas..." : "Vincular cuenta"}
            </button>
          </form>
        </section>

        <section className="rune-panel p-6">
          <h2 className="font-display text-lg font-semibold mb-4">
            Próximos pasos
          </h2>
          <ol className="flex flex-col gap-3 text-sm text-mist">
            <li className="flex gap-3">
              <span className="font-display text-teal">01</span>
              Vincular tu cuenta de Riot Games
            </li>
            <li className="flex gap-3">
              <span className="font-display text-teal">02</span>
              Cargar tus últimas partidas
            </li>
            <li className="flex gap-3">
              <span className="font-display text-teal">03</span>
              Ver tu primer plan de entrenamiento
            </li>
          </ol>
        </section>

        <section className="rune-panel p-6">
          <h2 className="font-display text-lg font-semibold mb-3">
            Qué vas a poder hacer aquí
          </h2>
          <p className="text-sm text-mist leading-relaxed">
            Cuando vincules tu cuenta, vamos a analizar tus partidas
            recientes, detectar los patrones que más te están costando
            partidas, y armarte un plan de entrenamiento semanal con
            explicaciones ancladas a tus propias métricas — no consejos
            genéricos.
          </p>
        </section>
      </div>
    );
  }

  const quickStats = computeQuickStats(matches);
  const lastSyncDate = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const validSyncDate = lastSyncDate && !Number.isNaN(lastSyncDate.getTime()) ? lastSyncDate : null;
  const soloTotal = (account.soloWins ?? 0) + (account.soloLosses ?? 0);
  const soloWinRate = soloTotal > 0
    ? Math.round(((account.soloWins ?? 0) / soloTotal) * 100)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="riot-card">
        <div className="riot-identity">
          <div className="riot-identity-main">
          <div className="avatar-wrap rank-avatar" data-tier={account.soloTier?.toLowerCase()}>
            {account.profileIconId
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${account.profileIconId}.png`}
                  alt=""
                  className={`avatar ${account.soloTier ? "avatar-ranked" : ""}`}
                />
              )
              : <div className="avatar" />}
            {account.soloTier && (
              <Image
                src={`/rank-frames/${account.soloTier.toLowerCase()}.png?v=original`}
                alt=""
                aria-hidden="true"
                width={account.soloTier === "PLATINUM" ? 554 : 2296}
                height={account.soloTier === "PLATINUM" ? 717 : 2976}
                sizes="256px"
                className="rank-frame-account"
              />
            )}
            {account.summonerLevel !== null && (
              <span className="level-badge tabular">{account.summonerLevel}</span>
            )}
          </div>
          <div className="identity-text">
            <div className="name-row">
              <span className="name">{account.summonerName}</span>
              <span className="tag">#{account.tagLine}</span>
              {emailVerified && (
                <span
                  aria-label="Email verificado"
                  title="Email verificado"
                  className="verified-badge"
                >
                  ✓
                </span>
              )}
            </div>
            <p className="ladder-rank">{account.region}</p>
          </div>
          </div>

          {account.soloTier && (
            <div className="rank-badge">
              <span className="rank-emblem-slot">
                <RankEmblem
                  tier={account.soloTier}
                  label={`Emblema de ${TIER_LABELS[account.soloTier] ?? account.soloTier}`}
                />
              </span>
              <div className="rank-badge-col">
                <span className="tier">
                  {TIER_LABELS[account.soloTier] ?? account.soloTier}{" "}
                  {account.soloRank}
                </span>
                <span className="meta tabular">{account.soloLp} LP</span>
              </div>
              <div className="rank-badge-col right">
                <span className="record tabular">
                  {account.soloWins}V {account.soloLosses}D
                </span>
                {soloWinRate !== null && (
                  <span className="meta tabular">{soloWinRate}% Win Rate</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sync-toolbar">
          <button
            onClick={handleSync}
            disabled={syncing}
            aria-busy={syncing}
            className="rune-btn btn-sm self-start"
          >
            {syncing ? "Actualizando..." : "Actualizar partidas"}
          </button>
          <p className="sync-status" role="status">
            {validSyncDate ? (
              <>Última sincronización: <time dateTime={validSyncDate.toISOString()}>
                {new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(validSyncDate)}
              </time></>
            ) : "Todavía no hay una sincronización completa registrada."}
          </p>
        </div>
        {syncNotice && (
          <p className={`sync-notice ${syncNotice.kind}`} role={syncNotice.kind === "error" ? "alert" : "status"}>
            {syncNotice.text}
          </p>
        )}

        {matches.length === 0
          ? <p className="text-mist text-sm">Todavía no hay partidas guardadas.</p>
          : (
            <div className="card-list rune-stagger" style={{ gap: "6px" }}>
              {matches.slice(0, 4).map((m, i) => {
                const items = [
                  m.rawStats.item0,
                  m.rawStats.item1,
                  m.rawStats.item2,
                  m.rawStats.item3,
                  m.rawStats.item4,
                  m.rawStats.item5,
                  m.rawStats.item6,
                ];
                const spells = [m.rawStats.summoner1Id, m.rawStats.summoner2Id];

                return (
                  <div
                    key={m.match?.id ?? i}
                    className={`match-row-mini ${m.win ? "win" : "loss"}${m.match?.id ? " is-navigable" : ""}`}
                  >
                    <div className="left">
                      <ChampionIcon champion={m.champion} version={ddragonVersion} className="mini-champ" />
                      <div className="flex gap-0.5">
                        {spells.map((spellId, si) => (
                          <SummonerSpellIcon key={si} spellId={spellId} version={ddragonVersion} spell={spellCatalog[spellId]} loading={spellsLoading} />
                        ))}
                      </div>
                      {m.match?.id ? (
                        <Link
                          href={`/dashboard/partida/${m.match.id}`}
                          className="dashboard-match-link"
                          aria-label={`Ver detalle de ${m.champion}, ${m.win ? "victoria" : "derrota"}, ${m.kills}/${m.deaths}/${m.assists}`}
                        >
                          {m.champion}
                        </Link>
                      ) : <span style={{ color: "var(--parchment)" }}>{m.champion}</span>}
                    </div>

                    <div className="match-build">
                      <div className="match-build-items">
                        {items.slice(0, 6).map((itemId, ii) => itemId ? (
                          <ItemIcon key={ii} itemId={itemId} version={ddragonVersion} item={itemCatalog[itemId]} loading={itemsLoading} />
                        ) : null)}
                      </div>
                      {!!items[6] && (
                        <ItemIcon itemId={items[6]} version={ddragonVersion} item={itemCatalog[items[6]]} loading={itemsLoading} className="match-trinket" />
                      )}
                    </div>

                    <span className="match-kda tabular">
                      <span className="kda-stat">
                        <span className="kda-label">K</span>
                        <span className="kda-num">{m.kills}</span>
                      </span>
                      <span className="kda-sep">/</span>
                      <span className="kda-stat">
                        <span className="kda-label">D</span>
                        <span className="kda-num">{m.deaths}</span>
                      </span>
                      <span className="kda-sep">/</span>
                      <span className="kda-stat">
                        <span className="kda-label">A</span>
                        <span className="kda-num">{m.assists}</span>
                      </span>
                    </span>
                    <span className={`result ${m.win ? "win" : "loss"}`}>
                      {m.win ? "Victoria" : "Derrota"}
                    </span>
                    <button
                      onClick={() =>
                        openChat("match", {
                          summonerName: account?.summonerName,
                          champion: m.champion,
                          win: m.win,
                          kills: m.kills,
                          deaths: m.deaths,
                          assists: m.assists,
                          csPerMin: m.metrics?.csPerMin,
                          kda: m.metrics?.kda,
                        })}
                      type="button"
                      aria-label={`Analizar partida de ${m.champion} con el coach`}
                      title="Analizar esta partida con tu coach"
                      className="match-coach-button"
                    >
                      <CoachIcon />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        {matches.length > 0 && (
          <Link
            href="/dashboard/historial"
            className="rune-link text-sm self-start"
          >
            Ver historial completo →
          </Link>
        )}
      </div>

      {quickStats && (
        <div className="quick-stats">
          <div className="stat-tile">
            <span className="val tabular">
              <CountUp value={quickStats.kdaAvg} decimals={2} />
            </span>
            <Tooltip className="metric-tooltip-trigger lbl" label="Qué significa KDA promedio" content={
              <><strong className="tooltip-title">KDA promedio</strong><p className="tooltip-copy">Promedio por partida de (asesinatos + asistencias) dividido entre muertes. Si no hubo muertes, se divide entre 1. Calculado sobre {quickStats.metricGames} partidas con métricas de las {quickStats.gamesAnalyzed} recientes guardadas.</p></>
            }>KDA promedio <span aria-hidden="true">ⓘ</span></Tooltip>
          </div>
          <div className="stat-tile">
            <span className="val tabular">
              <CountUp value={quickStats.winRate} suffix="%" />
            </span>
            <Tooltip className="metric-tooltip-trigger lbl" label="Qué significa Win rate" content={
              <><strong className="tooltip-title">Porcentaje de victorias</strong><p className="tooltip-copy">Victorias divididas entre las {quickStats.gamesAnalyzed} partidas recientes guardadas, multiplicado por 100. Es el porcentaje de esta muestra, no el de toda la temporada.</p></>
            }>Win rate ({quickStats.gamesAnalyzed}) <span aria-hidden="true">ⓘ</span></Tooltip>
          </div>
          <div className="stat-tile">
            <span className="val tabular">
              <CountUp value={quickStats.csAvg} decimals={1} />
            </span>
            <Tooltip className="metric-tooltip-trigger lbl" label="Qué significa CS por minuto" content={
              <><strong className="tooltip-title">CS por minuto</strong><p className="tooltip-copy">Súbditos y monstruos eliminados por minuto de partida. Es el promedio de las {quickStats.metricGames} partidas con métricas dentro de esta muestra reciente.</p></>
            }>CS / min <span aria-hidden="true">ⓘ</span></Tooltip>
          </div>
          <div className="stat-tile">
            <span className="val tabular">
              <CountUp value={quickStats.gamesAnalyzed} />
            </span>
            <Tooltip className="metric-tooltip-trigger lbl" label="Qué significa Partidas analizadas" content={
              <><strong className="tooltip-title">Partidas analizadas</strong><p className="tooltip-copy">Este resumen usa las {quickStats.gamesAnalyzed} partidas más recientes guardadas. Los acumulados por campeón pueden incluir más partidas históricas sincronizadas.</p></>
            }>Partidas analizadas <span aria-hidden="true">ⓘ</span></Tooltip>
          </div>
        </div>
      )}

      {(championStats.length > 0 || recentTeammates.length > 0) && (
        <div className="dash-columns mt-4">
          {championStats.length > 0 && (
            <div className="champ-stats-card">
              <div className="champ-stats-head">
                <h3>Champion Stats</h3>
                <span className="text-mist text-xs">Clasificatoria Solo/Dúo</span>
              </div>
              <div className="champ-head-row">
                <span>Campeón</span>
                <span>KDA</span>
                <span>% Victorias</span>
              </div>
              {championStats.slice(0, 7).map((c) => (
                <div key={c.champion} className="champ-row">
                  <div className="left">
                    <ChampionIcon champion={c.champion} version={ddragonVersion} className="champ-icon-sm" />
                    <div className="champ-id">
                      <span className="champ-name">{c.champion}</span>
                    </div>
                  </div>
                  <div className="champ-mid">
                    <span className="champ-kda-val tabular">
                      {c.avgKda.toFixed(2)} KDA
                    </span>
                    <span className="champ-kda-detail tabular">
                      {c.avgKills.toFixed(1)} / {c.avgDeaths.toFixed(1)} /{" "}
                      {c.avgAssists.toFixed(1)}
                    </span>
                  </div>
                  <div className="champ-right">
                    <span className="champ-winrate tabular">
                      {c.winRate}% <span className="champ-wr-label">WR</span>
                    </span>
                    <span className="champ-games tabular">
                      {c.games} partida{c.games === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentTeammates.length > 0 && (
            <div className="recent-with-card">
              <div className="recent-with-head">
                <h3>Jugado recientemente con</h3>
                <span>
                  Últimas {matches.length} partida{matches.length === 1 ? "" : "s"}
                </span>
              </div>
              <table className="recent-with-table">
                <thead>
                  <tr>
                    <th>Invocador</th>
                    <th>Jugadas</th>
                    <th>V - D</th>
                    <th>% Victorias</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTeammates.slice(0, 7).map((t) => (
                    <tr key={t.puuid}>
                      <td>
                        <div className="summoner-cell">
                          {t.profileIconId != null
                            ? (
                              <span className="summoner-avatar rank-avatar" data-tier={t.soloTier?.toLowerCase()}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${t.profileIconId}.png`}
                                  alt=""
                                  className="summoner-icon"
                                  onError={(e) => {
                                    e.currentTarget.style.visibility = "hidden";
                                  }}
                                />
                                {t.soloTier && (
                                  <Image
                                    src={`/rank-frames/${t.soloTier.toLowerCase()}.png?v=original`}
                                    alt=""
                                    aria-hidden="true"
                                    width={t.soloTier === "PLATINUM" ? 554 : 2296}
                                    height={t.soloTier === "PLATINUM" ? 717 : 2976}
                                    sizes="96px"
                                    className="rank-frame-teammate"
                                  />
                                )}
                              </span>
                            )
                            : <span className="summoner-avatar"><span className="summoner-icon" /></span>}
                          <span className="summoner-name">{t.summonerName}</span>
                        </div>
                      </td>
                      <td className="tabular">{t.games}</td>
                      <td className="tabular">
                        {t.wins} - {t.games - t.wins}
                      </td>
                      <td
                        className={`tabular win-ratio ${
                          t.winRate >= 55 ? "high" : t.winRate < 50 ? "low" : "mid"
                        }`}
                      >
                        {t.winRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
