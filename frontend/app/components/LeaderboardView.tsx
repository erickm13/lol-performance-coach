"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "../lib/useResource";
import { type ProfileResponse } from "../lib/player";
import { useChampionCatalog } from "../lib/useChampionCatalog";
import { ScrollRevealRoot } from "./ScrollRevealRoot";
import { CountUp } from "./CountUp";
import { ScreenState } from "./ScreenState";
type RankingData = {
  rows: {
    position: number;
    summonerName: string;
    tagLine: string;
    profileIconId: number | null;
    tier: string;
    division: string | null;
    lp: number | null;
    wins: number | null;
    losses: number | null;
    updatedAt: string | null;
    university: string | null;
    self: boolean;
  }[];
  universities: { id: string; name: string }[];
  pagination: { page: number; pages: number; total: number };
  region: string;
};
const TIERS: Record<string, string> = {
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
export function LeaderboardView() {
  const [region, setRegion] = useState("LAN"),
    [university, setUniversity] = useState("all"),
    [page, setPage] = useState(1);
  const resource = useResource<RankingData>(
    `/player/ranking?region=${region}&university=${
      encodeURIComponent(university)
    }&page=${page}`,
  );
  const profile = useResource<ProfileResponse>("/player/profile");
  const { version } = useChampionCatalog();
  const { data } = resource;
  return (
    <ScrollRevealRoot className="screen-stack motion-page ranking-page">
      <header className="page-head" data-reveal="up">
        <div>
          <h2>Ranking de la comunidad</h2>
          <p className="page-sub">
            Jugadores de la plataforma, ordenados por su rango oficial Solo/Dúo
            de Riot.
          </p>
        </div>
        <Link href="/dashboard/perfil" className="rune-link">
          Mi perfil y visibilidad →
        </Link>
      </header>
      <aside className="community-intro" data-reveal="up">
        <p>
          <strong>
            {profile.data?.profile?.rankingVisible
              ? "Tu participación está activada."
              : "Tú eliges si participas."}
          </strong>{" "}
          Para aparecer necesitas correo verificado, cuenta vinculada y rango
          guardado. Actualiza tus partidas en el dashboard para renovar tu
          rango.
        </p>
        <p className="page-sub">
          El ranking global incluye a todos los participantes de la región
          seleccionada. La universidad es opcional y declarada por cada jugador.
        </p>
      </aside>
      <div className="learning-filters" data-reveal="up">
        <label className="field-label">
          Región<select
            className="rune-field"
            value={region}
            onChange={(event) => {
              setRegion(event.target.value);
              setUniversity("all");
              setPage(1);
            }}
          >
            {[
              "LAN",
              "LAS",
              "NA",
              "BR",
              "EUW",
              "EUNE",
              "KR",
              "JP",
              "OCE",
              "TR",
              "RU",
              "PH",
              "SG",
              "TH",
              "TW",
              "VN",
            ].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field-label">
          Comunidad<select
            className="rune-field"
            value={university}
            onChange={(event) => {
              setUniversity(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Global · toda la plataforma</option>
            {data?.universities.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            {university !== "all" &&
              !data?.universities.some((item) => item.id === university) && (
              <option value={university}>Universidad seleccionada</option>
            )}
          </select>
        </label>
        {profile.data?.profile?.universityName && (
          <button
            type="button"
            className="rune-link"
            disabled={!data?.universities.some((item) =>
              item.name === profile.data?.profile?.universityName
            )}
            onClick={() => {
              const own = data?.universities.find((item) =>
                item.name === profile.data?.profile?.universityName
              );
              if (own) {
                setUniversity(own.id);
                setPage(1);
              }
            }}
          >
            Mi universidad →
          </button>
        )}
      </div>
      {resource.error
        ? (
          <ScreenState
            title="No pudimos cargar el ranking"
            retry={resource.reload}
          >
            {resource.error}
          </ScreenState>
        )
        : !data
        ? <ScreenState title="Consultando el ranking…" />
        : (
          <section className="section-surface" data-reveal="up">
            <header className="champ-stats-head">
              <h3>
                {university === "all"
                  ? "Comunidad global"
                  : data.universities.find((item) => item.id === university)
                    ?.name ?? "Tu comunidad"}
              </h3>
              <span>
                <CountUp value={data.pagination.total} startOnView />{" "}
                participantes · {region}
              </span>
            </header>
            {data.rows.length
              ? (
                <div className="table-scroll">
                  <table className="community-table">
                    <thead>
                      <tr>
                        <th>Posición</th>
                        <th>Jugador</th>
                        <th>Universidad</th>
                        <th>Rango</th>
                        <th>V / D</th>
                        <th>Actualización</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr
                          key={row.position}
                          className={row.self ? "ranking-self" : ""}
                        >
                          <td className="ranking-position">{row.position}</td>
                          <td>
                            <div className="ranking-identity">
                              {row.profileIconId !== null && (
                                <Image
                                  unoptimized
                                  width={40}
                                  height={40}
                                  src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${row.profileIconId}.png`}
                                  alt=""
                                />
                              )}
                              <div>
                                <strong>{row.summonerName}</strong>
                                <span className="page-sub">
                                  #{row.tagLine}
                                  {row.self ? " · Tú" : ""}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {row.university ?? "Sin universidad indicada"}
                          </td>
                          <td>
                            <div className="ranking-tier">
                              <Image
                                width={52}
                                height={52}
                                src={`/ranks/${row.tier.toLowerCase()}.png`}
                                alt=""
                              />
                              <span>
                                {TIERS[row.tier] ?? row.tier} {row.division}
                                <small>{row.lp ?? 0} LP</small>
                              </span>
                            </div>
                          </td>
                          <td className="tabular">
                            {row.wins ?? "—"} / {row.losses ?? "—"}
                          </td>
                          <td>
                            {row.updatedAt
                              ? (
                                <time dateTime={row.updatedAt}>
                                  {new Date(row.updatedAt).toLocaleDateString(
                                    "es",
                                    { day: "numeric", month: "short" },
                                  )}
                                </time>
                              )
                              : <span>Actualiza tus partidas</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
              : (
                <div className="section-body">
                  <h3>Aún no hay participantes en esta selección</h3>
                  <p className="page-sub">
                    Activa tu visibilidad en el perfil y sincroniza una cuenta
                    con rango. Si tu universidad todavía no aparece, se añadirá
                    cuando haya un participante elegible.
                  </p>
                  <Link href="/dashboard/perfil" className="rune-link">
                    Revisar mi participación →
                  </Link>
                </div>
              )}
            {data.pagination.pages > 1 && (
              <nav
                className="history-pagination"
                aria-label="Páginas del ranking"
              >
                <button
                  type="button"
                  className="btn-outline"
                  disabled={data.pagination.page <= 1}
                  onClick={() => setPage(data.pagination.page - 1)}
                >
                  ← Anterior
                </button>
                <span>
                  Página {data.pagination.page} de {data.pagination.pages}
                </span>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={data.pagination.page >= data.pagination.pages}
                  onClick={() => setPage(data.pagination.page + 1)}
                >
                  Siguiente →
                </button>
              </nav>
            )}
          </section>
        )}
      <p className="page-sub ranking-method">
        Orden: liga, división y LP. Los empates se ordenan por Riot ID. Se
        muestran las últimas cifras sincronizadas; no se calcula un ELO propio
        ni se compara el rendimiento entre servidores.
      </p>
    </ScrollRevealRoot>
  );
}
