"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";
import { useAiChat } from "./AiChatContext";

const DDRAGON_VERSION = "14.18.1";

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
  const { openChat } = useAiChat();

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
    <div className="rune-stagger flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-shrink-0">
            {account.profileIconId
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${account.profileIconId}.png`}
                  alt=""
                  className="h-16 w-16 rounded-[10px] border-2 border-teal"
                />
              )
              : (
                <div className="h-16 w-16 rounded-[10px] border-2 border-teal bg-gold-dim" />
              )}
            {account.summonerLevel !== null && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-ink border border-panel-line text-parchment text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap">
                {account.summonerLevel}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-semibold text-[22px] text-parchment">
                {account.summonerName}
              </span>
              <span className="text-mist text-[15px]">#{account.tagLine}</span>
              {emailVerified && (
                <span
                  aria-label="Email verificado"
                  title="Email verificado"
                  className="h-[18px] w-[18px] rounded-full bg-teal text-[11px] flex items-center justify-center font-bold flex-shrink-0"
                  style={{ color: "#06110f" }}
                >
                  ✓
                </span>
              )}
            </div>
            <p className="text-mist text-sm mt-1">{account.region}</p>
          </div>
        </div>

        {account.soloTier && (
          <div className="flex items-center gap-4 rune-field px-4 py-2.5 w-fit">
            <span
              aria-hidden="true"
              className="h-8 w-8 flex-shrink-0 rotate-45 border border-white/40"
              style={{
                background:
                  "linear-gradient(135deg, #8ff0e4 0%, #3ED6C4 55%, #1c7f74 100%)",
                boxShadow:
                  "0 0 10px rgba(62,214,196,0.55), inset 0 0 8px rgba(255,255,255,0.35)",
              }}
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-display font-semibold text-gold text-sm">
                {TIER_LABELS[account.soloTier] ?? account.soloTier}{" "}
                {account.soloRank}
              </span>
              <span className="text-mist text-xs">{account.soloLp} LP</span>
            </div>
            <div className="flex flex-col gap-0.5 items-end text-right">
              <span className="font-display font-semibold text-parchment text-sm">
                {account.soloWins}V {account.soloLosses}D
              </span>
              {soloWinRate !== null && (
                <span className="text-mist text-xs">
                  {soloWinRate}% de victorias
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleSync}
        disabled={syncing}
        className="rune-btn self-start"
      >
        {syncing ? "Actualizando..." : "Actualizar partidas"}
      </button>

      {matches.length === 0
        ? <p className="text-mist text-sm">Todavía no hay partidas guardadas.</p>
        : (
          <ul className="flex flex-col gap-2">
            {matches.map((m, i) => {
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
                <li
                  key={i}
                  className={`flex items-center justify-between flex-wrap gap-3 px-4 py-3 border-l-4 text-sm bg-ink/40 ${
                    m.win ? "border-l-teal" : "border-l-ember"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={championIconUrl(m.champion)}
                      alt={m.champion}
                      className="h-10 w-10"
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
                            <img
                              key={si}
                              src={url}
                              alt=""
                              className="h-5 w-5"
                            />
                          )
                          : <span key={si} className="h-5 w-5 bg-panel-line" />;
                      })}
                    </div>
                    <span className="font-medium">{m.champion}</span>
                  </div>

                  <div className="flex gap-0.5">
                    {items.map((itemId, ii) => {
                      const url = itemIconUrl(itemId);
                      return url
                        ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={ii} src={url} alt="" className="h-6 w-6" />
                        )
                        : (
                          <span
                            key={ii}
                            className="h-6 w-6 bg-panel-line/60"
                          />
                        );
                    })}
                  </div>

                  <span className="text-mist">
                    {m.kills}/{m.deaths}/{m.assists}
                  </span>
                  <span className={m.win ? "text-teal" : "text-ember"}>
                    {m.win ? "Victoria" : "Derrota"}
                  </span>
                  <button
                    onClick={() => openChat("match")}
                    aria-label="Analizar con IA"
                    title="Analizar con IA"
                    className="text-teal text-sm border border-teal/40 px-2 py-1 hover:bg-teal/10 transition-colors"
                  >
                    ✨
                  </button>
                </li>
              );
            })}
          </ul>
        )}

      {quickStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-panel-line">
          <div className="flex flex-col items-center text-center gap-1 px-3 py-3">
            <span className="font-display text-xl font-semibold text-parchment">
              {quickStats.kdaAvg.toFixed(2)}
            </span>
            <span className="text-mist text-xs">KDA promedio</span>
          </div>
          <div className="flex flex-col items-center text-center gap-1 px-3 py-3">
            <span className="font-display text-xl font-semibold text-parchment">
              {quickStats.winRate}%
            </span>
            <span className="text-mist text-xs">
              Win rate ({quickStats.gamesAnalyzed})
            </span>
          </div>
          <div className="flex flex-col items-center text-center gap-1 px-3 py-3">
            <span className="font-display text-xl font-semibold text-parchment">
              {quickStats.csAvg.toFixed(1)}
            </span>
            <span className="text-mist text-xs">CS / min</span>
          </div>
          <div className="flex flex-col items-center text-center gap-1 px-3 py-3">
            <span className="font-display text-xl font-semibold text-parchment">
              {quickStats.gamesAnalyzed}
            </span>
            <span className="text-mist text-xs">Partidas analizadas</span>
          </div>
        </div>
      )}

      {(championStats.length > 0 || recentTeammates.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {championStats.length > 0 && (
            <div className="flex flex-col">
              <div className="rune-panel px-4 py-3 mb-4 flex items-center justify-between gap-3">
                <h3 className="font-display font-semibold text-sm">
                  Champion Stats
                </h3>
                <span className="text-mist text-xs">
                  Clasificatoria Solo/Dúo
                </span>
              </div>
              <ul className="flex flex-col">
                {championStats.slice(0, 5).map((c) => (
                  <li
                    key={c.champion}
                    className="flex items-center justify-between gap-3 text-sm py-2.5 px-[18px] border-b border-panel-line last:border-b-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={championIconUrl(c.champion)}
                        alt=""
                        className="h-8 w-8 rounded flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                      <span className="font-medium truncate">
                        {c.champion}
                      </span>
                    </div>
                    <div className="flex flex-col text-right flex-shrink-0">
                      <span className="text-parchment font-medium">
                        {c.avgKda.toFixed(2)} KDA
                      </span>
                      <span className="text-mist text-xs">
                        {c.avgKills.toFixed(1)} / {c.avgDeaths.toFixed(1)} /
                        {" "}
                        {c.avgAssists.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex flex-col text-right flex-shrink-0">
                      <span className="text-parchment font-medium">
                        {c.winRate}%
                      </span>
                      <span className="text-mist text-xs">
                        {c.games} partida{c.games === 1 ? "" : "s"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recentTeammates.length > 0 && (
            <div className="flex flex-col">
              <div className="rune-panel px-4 py-3 mb-4 flex items-center justify-between gap-3">
                <h3 className="font-display font-semibold text-sm">
                  Jugado recientemente con
                </h3>
                <span className="text-mist text-xs">
                  Últimas {matches.length} partida{matches.length === 1 ? "" : "s"}
                </span>
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] uppercase tracking-wide text-mist font-medium py-2.5 px-5 border-b border-panel-line whitespace-nowrap">
                      Invocador
                    </th>
                    <th className="text-right text-[11px] uppercase tracking-wide text-mist font-medium py-2.5 px-5 border-b border-panel-line whitespace-nowrap">
                      Jugadas
                    </th>
                    <th className="text-right text-[11px] uppercase tracking-wide text-mist font-medium py-2.5 px-5 border-b border-panel-line whitespace-nowrap">
                      V - D
                    </th>
                    <th className="text-right text-[11px] uppercase tracking-wide text-mist font-medium py-2.5 px-5 border-b border-panel-line whitespace-nowrap">
                      % Victorias
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTeammates.slice(0, 8).map((t, i) => (
                    <tr
                      key={t.puuid}
                      className={
                        i === recentTeammates.slice(0, 8).length - 1
                          ? ""
                          : "[&>td]:border-b [&>td]:border-panel-line"
                      }
                    >
                      <td className="py-2.5 px-5 font-medium text-parchment truncate max-w-[180px]">
                        {t.summonerName}
                      </td>
                      <td className="py-2.5 px-5 text-right tabular-nums whitespace-nowrap">
                        {t.games}
                      </td>
                      <td className="py-2.5 px-5 text-right tabular-nums whitespace-nowrap">
                        {t.wins} - {t.games - t.wins}
                      </td>
                      <td
                        className={`py-2.5 px-5 text-right font-semibold tabular-nums whitespace-nowrap ${
                          t.winRate >= 50 ? "text-teal" : "text-ember"
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
