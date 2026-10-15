"use client";
import { AcademyText } from "./AcademyText";
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
import { LearningIcon } from "./LearningIcon";
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
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const findings = [...data.weaknesses].sort((a, b) =>
    (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
  );
  const highPriority =
    findings.filter((finding) => finding.severity === "high").length;
  return (
    <ScrollRevealRoot className="screen-stack motion-page weaknesses-page learning-page">
      <header className="page-head" data-reveal="up">
        <div>
          <span className="learning-eyebrow">ENTIENDE TUS PARTIDAS</span>
          <h2>¿Qué puedes mejorar?</h2>
          <p className="page-sub">
            Descubre los patrones, revisa las partidas y elige qué practicar.
          </p>
        </div>
        <Link
          className="btn-outline learning-page-link"
          href="/dashboard/entrenamiento"
        >
          Mi entrenamiento →
        </Link>
      </header>
      <section
        className="learning-snapshot"
        aria-label="Resumen del análisis"
        data-reveal="up"
      >
        <div className="learning-snapshot-stat">
          <span>Partidas analizadas</span>
          <strong>
            {data.sample
              ? (
                <>
                  <CountUp value={data.sample.count} startOnView />
                  <small>/ {data.sample.required}</small>
                </>
              )
              : "Últimas guardadas"}
          </strong>
          <small>Muestra de las últimas diez partidas</small>
        </div>
        <div className="learning-snapshot-stat">
          <span>Áreas para mejorar</span>
          <strong>
            <CountUp value={findings.length} startOnView />
          </strong>
          <small>Patrones detectados por el sistema</small>
        </div>
        <div className="learning-snapshot-stat">
          <span>Prioridad alta</span>
          <strong className={highPriority ? "learning-priority-number" : ""}>
            <CountUp value={highPriority} startOnView />
          </strong>
          <small>Hallazgos para revisar primero</small>
        </div>
        <Link className="rune-link learning-snapshot-action" href="/dashboard">
          Actualizar partidas →
        </Link>
      </section>
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
      {!!findings.length && (
        <div className="learning-section-intro" data-reveal="up">
          <div>
            <h3>Tus áreas de mejora</h3>
            <p>
              Ordenadas por prioridad. Cada hallazgo incluye una acción y sus
              evidencias.
            </p>
          </div>
          <nav
            className="weakness-jump-nav"
            aria-label="Ir a un área de mejora"
          >
            {findings.map((finding) => (
              <a key={finding.id} href={`#weakness-${finding.category}`}>
                <LearningIcon kind={finding.category} />
                {CATEGORIES[finding.category] ?? finding.category}
              </a>
            ))}
          </nav>
        </div>
      )}
      <div className="weakness-action-list">
        {findings.map((w, index) => (
          <article
            id={`weakness-${w.category}`}
            key={w.id}
            className="section-surface weakness-action-card"
            data-priority={w.severity}
            data-reveal="up"
            data-reveal-delay={String(index % 2)}
          >
            <header className="learning-card-heading">
              <span className="learning-category-icon">
                <LearningIcon kind={w.category} />
              </span>
              <div>
                <span className="learning-card-kicker">
                  ÁREA {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{CATEGORIES[w.category] ?? w.category}</h3>
              </div>
              <span className={`badge badge-${w.severity}`}>
                Prioridad {SEVERITIES[w.severity] ?? w.severity}
              </span>
            </header>
            <div className="section-body">
              <div className="weakness-reason">
                <div className="weakness-observation">
                  <h4>Lo que muestran tus partidas</h4>
                  <p className="desc">
                    <AcademyText text={w.description} />
                  </p>
                </div>
                <div className="weakness-next-action">
                  <span className="learning-card-kicker">
                    TU SIGUIENTE PASO
                  </span>
                  <p className="desc">
                    {GOALS[w.category] ??
                      "Revisa estas decisiones y prepara tu próximo ejercicio."}
                  </p>
                  <Link
                    className="learning-action-link"
                    href={plan.data?.items.some((item) =>
                        itemCategory(item) === w.category
                      )
                      ? `/dashboard/entrenamiento#training-${w.category}`
                      : "/dashboard/entrenamiento"}
                  >
                    {plan.data?.items.some((item) =>
                        itemCategory(item) === w.category
                      )
                      ? "Practicar esta área"
                      : "Preparar mi entrenamiento"} →
                  </Link>
                </div>
              </div>
              <details className="weakness-evidence">
                <summary>
                  Ver partidas de evidencia{w.evidenceMatches?.length
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
      {data.analysis && (
        <details className="analysis-method learning-method" data-reveal="up">
          <summary>Cómo se detectan estos patrones</summary>
          <p className="page-sub">
            {data.analysis.note}{" "}
            La referencia se elige por el rol registrado en cada partida, no por
            tu preferencia de perfil.
          </p>
          <div className="table-scroll">
            <table className="reference-table">
              <thead>
                <tr>
                  <th>Línea</th>
                  <th>CS/min</th>
                  <th>Visión/min</th>
                  <th>Participación en kills</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.analysis.references).map(([key, item]) => (
                  <tr key={key}>
                    <th>{item.label}</th>
                    <td>{item.cs ?? "No se evalúa"}</td>
                    <td>{item.vision}</td>
                    <td>{Math.round(item.participation * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </ScrollRevealRoot>
  );
}
