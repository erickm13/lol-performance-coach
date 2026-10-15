"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBackendUrl } from "../lib/api";
import { useAiChat } from "./AiChatContext";
import { CountUp } from "./CountUp";

let DDRAGON_VERSION = "16.20.1";

const SUMMONER_SPELL_ICONS: Record<number, string> = {
  1: "SummonerBoost",
  3: "SummonerExhaust",
  4: "SummonerFlash",
  6: "SummonerHaste",
  7: "SummonerHeal",
  11: "SummonerSmite",
  12: "SummonerTeleport",
  13: "SummonerMana",
  14: "SummonerDot",
  21: "SummonerBarrier",
  32: "SummonerSnowball",
};

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

function itemIconUrl(itemId: number): string | null {
  if (!itemId) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`;
}

function spellIconUrl(spellId: number): string | null {
  const name = SUMMONER_SPELL_ICONS[spellId];
  if (!name) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${name}.png`;
}

function championIconUrl(champion: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${champion}.png`;
}

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
  return { kdaAvg, csAvg, winRate, gamesAnalyzed: matches.length };
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
  const [, bumpDdragon] = useState(0);
  const { openChat } = useAiChat();

  // Mantiene la versión de Data Dragon al día para que no falten íconos/ítems nuevos.
  useEffect(() => {
    let active = true;
    fetch("https://ddragon.leagueoflegends.com/api/versions.json")
      .then((r) => r.json())
      .then((versions: string[]) => {
        if (active && versions[0] && versions[0] !== DDRAGON_VERSION) {
          DDRAGON_VERSION = versions[0];
          bumpDdragon((n) => n + 1);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function loadAccount() {
    try {
      const res = await fetch(`${getBackendUrl()}/riot/account`, {
        credentials: "include",
      });
      const data = await res.json();
      setAccount(data.account);
      setMatches(data.matches ?? []);
      setChampionStats(data.championStats ?? []);
      setRecentTeammates(data.recentTeammates ?? []);
    } catch {
      // Sin conexión: dejamos el estado como estaba, el usuario puede reintentar.
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
    try {
      const res = await fetch(`${getBackendUrl()}/riot/sync`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await loadAccount();
      }
    } catch {
      // Sin conexión: el usuario puede reintentar con el mismo botón.
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
            Qué vas a poder hacer acá
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
  const soloTotal = (account.soloWins ?? 0) + (account.soloLosses ?? 0);
  const soloWinRate = soloTotal > 0
    ? Math.round(((account.soloWins ?? 0) / soloTotal) * 100)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="riot-card">
        <div className="riot-identity">
          <div className="riot-identity-main">
          <div className="avatar-wrap">
            {account.profileIconId
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${account.profileIconId}.png`}
                  alt=""
                  className="avatar"
                />
              )
              : <div className="avatar" />}
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
              <div className="rank-emblem" aria-hidden="true" />
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

        <button
          onClick={handleSync}
          disabled={syncing}
          className="rune-btn btn-sm self-start"
        >
          {syncing ? "Actualizando..." : "Actualizar partidas"}
        </button>

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
                    key={i}
                    className={`match-row-mini ${m.win ? "win" : "loss"}`}
                  >
                    <div className="left">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={championIconUrl(m.champion)}
                        alt={m.champion}
                        className="mini-champ"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                      <div className="flex gap-0.5">
                        {spells.map((s, si) => {
                          const url = spellIconUrl(s);
                          return url
                            ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={si} src={url} alt="" className="mini-spell" />
                            )
                            : <span key={si} className="mini-spell" />;
                        })}
                      </div>
                      <span style={{ color: "var(--parchment)" }}>
                        {m.champion}
                      </span>
                    </div>

                    <div className="flex gap-0.5">
                      {items.map((itemId, ii) => {
                        const url = itemIconUrl(itemId);
                        return url
                          ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={ii} src={url} alt="" className="mini-item" />
                          )
                          : <span key={ii} className="mini-item" />;
                      })}
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
                      aria-label="Analizar con IA"
                      title="Analizar con IA"
                      className="text-teal text-sm border border-teal/40 px-2 py-1 hover:bg-teal/10 transition-colors"
                    >
                      ✨
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
            <span className="lbl">KDA promedio</span>
          </div>
          <div className="stat-tile">
            <span className="val tabular">
              <CountUp value={quickStats.winRate} suffix="%" />
            </span>
            <span className="lbl">Win rate ({quickStats.gamesAnalyzed})</span>
          </div>
          <div className="stat-tile">
            <span className="val tabular">
              <CountUp value={quickStats.csAvg} decimals={1} />
            </span>
            <span className="lbl">CS / min</span>
          </div>
          <div className="stat-tile">
            <span className="val tabular">
              <CountUp value={quickStats.gamesAnalyzed} />
            </span>
            <span className="lbl">Partidas analizadas</span>
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={championIconUrl(c.champion)}
                      alt=""
                      className="champ-icon-sm"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
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
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${t.profileIconId}.png`}
                                alt=""
                                className="summoner-icon"
                                onError={(e) => {
                                  e.currentTarget.style.visibility = "hidden";
                                }}
                              />
                            )
                            : <div className="summoner-icon" />}
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
