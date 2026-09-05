"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

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

type Match = {
  champion: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  rawStats: RawParticipant;
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

export function RiotAccountCard() {
  const [account, setAccount] = useState<RiotAccount | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAccount() {
    try {
      const res = await fetch(`${getBackendUrl()}/riot/account`, {
        credentials: "include",
      });
      const data = await res.json();
      setAccount(data.account);
      setMatches(data.matches ?? []);
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
    );
  }

  return (
    <section className="rune-panel p-6">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
        <div className="flex items-center gap-3">
          {account.profileIconId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${account.profileIconId}.png`}
              alt=""
              className="h-12 w-12"
            />
          )}
          <div>
            <p className="font-display font-semibold">
              {account.summonerName}#{account.tagLine}
            </p>
            <p className="text-mist text-sm">
              {account.region} · Nivel {account.summonerLevel ?? "—"}
            </p>
          </div>
        </div>
        <button onClick={handleSync} disabled={syncing} className="rune-btn">
          {syncing ? "Actualizando..." : "Actualizar partidas"}
        </button>
      </div>

      {account.soloTier && (
        <div className="mb-5 flex items-center gap-3 rune-field w-fit px-4 py-2">
          <span className="font-display font-semibold text-gold">
            {TIER_LABELS[account.soloTier] ?? account.soloTier} {account.soloRank}
          </span>
          <span className="text-mist text-sm">{account.soloLp} LP</span>
          <span className="text-mist text-sm">
            {account.soloWins}V {account.soloLosses}D
          </span>
        </div>
      )}

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
                      src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${m.champion}.png`}
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
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}
