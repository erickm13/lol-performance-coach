"use client";
import Link from "next/link";
import { useResource } from "../lib/useResource";
import {
  CATEGORIES,
  GOALS,
  itemCategory,
  type PlanData,
  SEVERITIES,
  type WeaknessData,
} from "../lib/training";
import { matchDate } from "../lib/matches";
import { ScreenState } from "./ScreenState";
import { ScrollRevealRoot } from "./ScrollRevealRoot";
import { CountUp } from "./CountUp";
export function WeaknessesList() {
  const resource = useResource<WeaknessData>("/riot/weaknesses");
  const plan = useResource<PlanData>("/riot/training-plan");
  const { data } = resource;
  if (resource.error) {
    return (
      <ScreenState
        title="No pudimos cargar tus debilidades"
        retry={resource.reload}
      >
        {resource.error}
      </ScreenState>
    );
  }
  if (!data) return <ScreenState title="Buscando patrones en tus partidas…" />;
  if (data.linked === false) {
    return (
      <ScreenState
        title="Primero conecta tu cuenta de Riot"
        link={{ href: "/dashboard", label: "Vincular cuenta" }}
      >
        Tus partidas permiten detectar patrones y preparar ejercicios para ti.
      </ScreenState>
    );
  }
  const insufficient = data.sample && data.sample.count < data.sample.required;
  return (
    <ScrollRevealRoot className="screen-stack motion-page weaknesses-page">
      <header className="page-head" data-reveal="up">
        <div>
          <h2>Debilidades detectadas</h2>
          <p className="page-sub">
            Patrones de las últimas diez partidas guardadas, de las colas que
            hayas sincronizado.
          </p>
        </div>
        <Link className="rune-link" href="/dashboard/entrenamiento">
          Ir a mi entrenamiento →
        </Link>
      </header>
      <div className="analysis-sample" data-reveal="up">
        <div>
          <span className="teaser-label">Muestra disponible</span>
          <p>
            {data.sample
              ? (
                <>
                  <CountUp value={data.sample.count} startOnView /> de{" "}
                  {data.sample.required} partidas con métricas
                </>
              )
              : "Últimas partidas guardadas"}
          </p>
        </div>
        <div>
          <span className="teaser-label">Patrones detectados</span>
          <p>
            <CountUp value={data.weaknesses.length} startOnView />
          </p>
        </div>
        <Link className="rune-link" href="/dashboard">
          Actualizar partidas →
        </Link>
      </div>
      {insufficient && (
        <ScreenState
          title="Todavía faltan partidas para detectar patrones"
          link={{ href: "/dashboard", label: "Actualizar mis partidas" }}
        >
          Hay {data.sample!.count}{" "}
          partidas con métricas en la ventana de diez. Necesitas{" "}
          {data.sample!.required}{" "}
          para completar la muestra.{data.weaknesses.length
            ? " Los hallazgos siguientes pertenecen al último análisis guardado."
            : ""}
        </ScreenState>
      )}
      {!insufficient && !data.weaknesses.length && (
        <ScreenState
          title="Sin debilidades detectadas en esta muestra"
          link={{
            href: "/dashboard/historial",
            label: "Explorar mis partidas",
          }}
        >
          Las reglas no detectaron patrones por encima de sus umbrales. Sigue
          revisando tus partidas para encontrar oportunidades de mejora.
        </ScreenState>
      )}
      <div className="weakness-action-list">
        {data.weaknesses.map((w, index) => (
          <article
            id={`weakness-${w.category}`}
            key={w.id}
            className="section-surface weakness-action-card"
            data-reveal="up"
            data-reveal-delay={String(index % 3)}
          >
            <header className="champ-stats-head">
              <h3>{CATEGORIES[w.category] ?? w.category}</h3>
              <span className={`badge badge-${w.severity}`}>
                Prioridad {SEVERITIES[w.severity] ?? w.severity}
              </span>
            </header>
            <div className="section-body">
              <div className="weakness-reason">
                <div>
                  <span className="teaser-label">
                    Qué muestran tus partidas
                  </span>
                  <p className="desc">{w.description}</p>
                </div>
                <div>
                  <span className="teaser-label">Qué puedes trabajar</span>
                  <p className="desc">
                    {GOALS[w.category] ??
                      "Revisa estas decisiones y prepara tu próximo ejercicio."}
                  </p>
                  <Link
                    className="rune-link"
                    href={plan.data?.items.some((item) =>
                        itemCategory(item) === w.category
                      )
                      ? `/dashboard/entrenamiento#training-${w.category}`
                      : "/dashboard/entrenamiento"}
                  >
                    {plan.data?.items.some((item) =>
                        itemCategory(item) === w.category
                      )
                      ? "Ver ejercicios para este objetivo"
                      : "Preparar mi entrenamiento"} →
                  </Link>
                </div>
              </div>
              <details className="weakness-evidence">
                <summary>
                  Partidas que sustentan este hallazgo{w.evidenceMatches?.length
                    ? ` (${w.evidenceMatches.length})`
                    : ""}
                </summary>
                {w.evidenceMatches?.length
                  ? (
                    <div className="evidence-match-list">
                      {w.evidenceMatches.map((match) => (
                        <Link
                          className="evidence-match"
                          key={match.participantId}
                          href={`/dashboard/partida/${match.matchId}`}
                        >
                          <strong>{match.champion}</strong>
                          <time dateTime={match.playedAt}>
                            {matchDate(match.playedAt)}
                          </time>
                          <span
                            className={match.win ? "text-teal" : "text-ember"}
                          >
                            {match.win ? "Victoria" : "Derrota"}
                          </span>
                          <span className="rune-link">Ver detalle →</span>
                        </Link>
                      ))}
                    </div>
                  )
                  : (
                    <p className="page-sub">
                      Las partidas de evidencia no están disponibles en tu
                      historial actual.
                    </p>
                  )}
              </details>
              {w.detectedAt && (
                <p className="analysis-date">
                  Último análisis:{" "}
                  {matchDate(w.detectedAt)}. La prioridad corresponde a las
                  reglas del sistema.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </ScrollRevealRoot>
  );
}
