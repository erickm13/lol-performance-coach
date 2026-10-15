"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "../lib/useResource";
import { useTrainingPlan } from "../lib/useTrainingPlan";
import {
  CATEGORIES,
  GOALS,
  itemCategory,
  itemTitle,
  type PlanItem,
  SEVERITIES,
  trainingCopy,
  type WeaknessData,
} from "../lib/training";
import { ScreenState } from "./ScreenState";
import { ScrollRevealRoot } from "./ScrollRevealRoot";
import { CountUp } from "./CountUp";
import { ProgressMeter } from "./ProgressMeter";
import { Tooltip } from "./Tooltip";
import { useDataDragon } from "../lib/useDataDragon";
import { ChampionIcon } from "./ChampionIcon";

const SPOTS: Record<string, { x: number; y: number; label: string }> = {
  farming: {
    x: 49,
    y: 48,
    label: "Línea central; adapta el ejercicio a tu línea",
  },
  vision: { x: 40, y: 36, label: "Río superior" },
  early_game: {
    x: 23,
    y: 43,
    label: "Línea superior; adapta el ejercicio a tu línea",
  },
  consistency: {
    x: 72,
    y: 75,
    label: "Línea inferior; adapta el ejercicio a tu línea",
  },
  objectives: { x: 58, y: 63, label: "Río junto al dragón" },
};
const date = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
export function TrainingHub() {
  const weaknesses = useResource<WeaknessData>("/riot/weaknesses");
  const plan = useTrainingPlan();
  const assets = useDataDragon();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(true);
  const error = weaknesses.error || plan.error;
  if (error) {
    return (
      <ScreenState
        title="No pudimos cargar tu entrenamiento"
        retry={() => {
          weaknesses.reload();
          plan.reload();
        }}
      >
        {error}
      </ScreenState>
    );
  }
  if (!weaknesses.data || !plan.data) {
    return <ScreenState title="Preparando tu entrenamiento…" />;
  }
  if (weaknesses.data.linked === false) {
    return (
      <ScreenState
        title="Tu entrenamiento empieza con tus partidas"
        link={{ href: "/dashboard", label: "Vincular cuenta de Riot" }}
      >
        Conecta tu cuenta para crear un plan basado en tus partidas.
      </ScreenState>
    );
  }
  const { items } = plan.data;
  const drills = items.filter((item) => item.type === "drill");
  const recommendations = items.filter((item) =>
    !["focus_area", "drill"].includes(item.type)
  );
  const pending = drills.filter((item) => !item.completed);
  const done = drills.length - pending.length;
  const progress = drills.length ? Math.round(done / drills.length * 100) : 0;
  const next = pending[0];
  const focus = items.find((item) => item.type === "focus_area");
  const urgent = weaknesses.data.weaknesses[0];
  const category = focus ? itemCategory(focus) : urgent?.category;
  const groups = [
    ...new Set(
      items.filter((item) => ["focus_area", "drill"].includes(item.type)).map(
        itemCategory,
      ),
    ),
  ].sort((a, b) => {
    const hasPending = (group: string) =>
      drills.some((item) => itemCategory(item) === group && !item.completed);
    return Number(hasPending(b)) - Number(hasPending(a));
  });
  const selected = drills.find((item) => item.id === selectedId) ?? next ??
    drills[0];
  const selectedSpot = selected ? SPOTS[itemCategory(selected)] : null;
  const enough = !weaknesses.data.sample ||
    weaknesses.data.sample.count >= weaknesses.data.sample.required;
  function check(item: PlanItem, label: string) {
    return (
      <div className="training-item-action">
        <button
          type="button"
          className={item.completed ? "btn-outline" : "rune-btn btn-sm"}
          disabled={item.completed || plan.pending.includes(item.id)}
          onClick={() => plan.complete(item.id)}
          aria-label={`${label}: ${itemTitle(item)}`}
        >
          {item.completed
            ? "✓ Completado"
            : plan.pending.includes(item.id)
            ? "Guardando…"
            : label}
        </button>
        {plan.itemErrors[item.id] && (
          <p className="text-ember" role="alert">{plan.itemErrors[item.id]}</p>
        )}
      </div>
    );
  }
  function explanation(item: PlanItem) {
    return item.llmExplanation && item.llmExplanation !== item.description
      ? (
        <details className="training-explanation">
          <summary>Por qué lo recomienda el coach</summary>
          <p>{trainingCopy(item.llmExplanation)}</p>
        </details>
      )
      : null;
  }
  return (
    <ScrollRevealRoot className="screen-stack motion-page training-page">
      <header className="page-head" data-reveal="up">
        <div>
          <h2>Entrenamiento</h2>
          <p className="page-sub">
            De lo que muestran tus partidas a lo que puedes practicar hoy.
          </p>
        </div>
        <Link href="/dashboard/debilidades" className="rune-link">
          Explorar mis debilidades →
        </Link>
      </header>
      {plan.notice && (
        <p className="training-save-notice" role="status">{plan.notice}</p>
      )}
      <div className="training-overview">
        <section className="training-focus section-surface" data-reveal="left">
          <header className="champ-stats-head">
            <h3>Tu objetivo semanal</h3>
            {plan.data.plan && (
              <span>
                {date(plan.data.plan.weekStart)} —{" "}
                {date(plan.data.plan.weekEnd)}
              </span>
            )}
          </header>
          <div className="section-body">
            <span className="teaser-label">
              {category
                ? CATEGORIES[category] ?? "Tu foco"
                : "Tu punto de partida"}
            </span>
            <h3>
              {category
                ? GOALS[category] ??
                  "Lleva tus objetivos a la siguiente partida."
                : enough
                ? "Prepara tu próxima práctica"
                : "Completa tu muestra de partidas"}
            </h3>
            <p className="desc">
              {trainingCopy(
                focus?.description ?? urgent?.description ?? (enough
                  ? "No hay patrones de debilidad detectados en la muestra actual. Sigue revisando tus decisiones."
                  : `Necesitas ${
                    weaknesses.data.sample?.required ?? 10
                  } partidas con métricas para detectar patrones.`),
              )}
            </p>
            {urgent && !focus && (
              <span className={`badge badge-${urgent.severity}`}>
                Prioridad {SEVERITIES[urgent.severity] ?? urgent.severity}
              </span>
            )}
            {!plan.data.plan && (
              <div className="training-item-action">
                {enough
                  ? (
                    <button
                      className="rune-btn"
                      disabled={plan.generating}
                      onClick={plan.generate}
                    >
                      {plan.generating
                        ? "Preparando tu plan…"
                        : "Generar mi plan semanal"}
                    </button>
                  )
                  : (
                    <Link className="rune-btn" href="/dashboard">
                      Actualizar partidas
                    </Link>
                  )}
              </div>
            )}
            {plan.generating && (
              <p className="page-sub" role="status">
                El coach está preparando las explicaciones. Puedes esperar aquí.
              </p>
            )}
            {plan.mutationError && (
              <p className="text-ember" role="alert">{plan.mutationError}</p>
            )}
            {plan.data.message && (
              <p className="page-sub" role="status">{plan.data.message}</p>
            )}
          </div>
        </section>
        <section className="section-surface" data-reveal="right">
          <header className="champ-stats-head">
            <h3>Tu progreso semanal</h3>
          </header>
          <div className="section-body training-progress">
            <strong className="training-progress-value">
              {drills.length
                ? <CountUp value={progress} from={100} suffix="%" startOnView />
                : "—"}
            </strong>
            <p>
              {drills.length
                ? (
                  <>
                    <CountUp value={done} startOnView /> de{" "}
                    <CountUp value={drills.length} startOnView />{" "}
                    ejercicios completados
                  </>
                )
                : plan.data.plan
                ? "Este plan contiene recomendaciones, sin ejercicios."
                : "Genera tu plan para comenzar."}
            </p>
            {!!drills.length && (
              <ProgressMeter
                value={progress}
                label="Ejercicios completados esta semana"
              />
            )}
            <p className="page-sub">
              Este porcentaje registra tu práctica. Para valorar cambios en tu
              rendimiento, revisa tus próximas partidas.
            </p>
            <Link href="/dashboard/historial" className="rune-link">
              Revisar mis partidas →
            </Link>
          </div>
        </section>
      </div>
      {drills.length > 0 && (
        <section className="training-next section-surface" data-reveal="up">
          <span className="teaser-label">Tu próxima práctica</span>
          <h3>
            {next
              ? itemTitle(next)
              : "Has completado los ejercicios de esta semana"}
          </h3>
          <p className="desc">
            {next
              ? trainingCopy(next.description)
              : "Revisa tus nuevas partidas para observar cómo aplicaste lo aprendido. Tu siguiente plan estará disponible la próxima semana."}
          </p>
          {next && (
            <a
              className="rune-link"
              href={`#exercise-${next.id}`}
              onClick={() => setSelectedId(next.id)}
            >
              Ir al ejercicio →
            </a>
          )}
        </section>
      )}
      {!!items.length && (
        <section id="weekly-plan" className="section-surface" data-reveal="up">
          <header className="champ-stats-head">
            <h3>Tu plan semanal</h3>
            <button
              type="button"
              className="rune-link"
              aria-pressed={showDone}
              onClick={() =>
                setShowDone((old) =>
                  !old
                )}
            >
              {showDone
                ? "Ocultar ejercicios completados"
                : `Ver completados (${done})`}
            </button>
          </header>
          <div className="training-groups">
            {groups.map((group) => {
              const groupItems = items.filter((item) =>
                itemCategory(item) === group
              );
              const groupFocus = groupItems.find((item) =>
                item.type === "focus_area"
              );
              const groupDrills = groupItems.filter((item) =>
                item.type === "drill"
              );
              return (
                <article
                  key={group}
                  id={`training-${group}`}
                  className="training-group"
                  data-reveal="up"
                >
                  <div className="training-group-head">
                    <h3>{CATEGORIES[group] ?? "Práctica personalizada"}</h3>
                    <Link
                      className="rune-link"
                      href={`/dashboard/debilidades#weakness-${group}`}
                    >
                      Ver evidencia →
                    </Link>
                  </div>
                  {groupFocus && (
                    <div className="training-group-focus">
                      <p className="desc">
                        {trainingCopy(groupFocus.description)}
                      </p>
                      <details className="training-explanation">
                        <summary>Revisar el objetivo</summary>
                        {groupFocus.llmExplanation && (
                          <p>{trainingCopy(groupFocus.llmExplanation)}</p>
                        )}
                        {check(groupFocus, "He revisado el objetivo")}
                      </details>
                    </div>
                  )}
                  {groupDrills.filter((item) => showDone || !item.completed)
                    .sort((a, b) =>
                      Number(a.completed) - Number(b.completed)
                    )
                    .map((item) => (
                      <div
                        id={`exercise-${item.id}`}
                        key={item.id}
                        className={`training-exercise${
                          item.completed ? " completed" : ""
                        }`}
                        data-reveal="up"
                      >
                        <div>
                          <span className="teaser-label">Ejercicio</span>
                          <h4>{itemTitle(item)}</h4>
                          <p className="desc">
                            {trainingCopy(item.description)}
                          </p>
                          {explanation(item)}
                          <a
                            href="#practice-map"
                            className="rune-link"
                            onClick={() => setSelectedId(item.id)}
                          >
                            Ver zona de práctica →
                          </a>
                        </div>
                        {check(item, "Marcar como completado")}
                      </div>
                    ))}
                  {!showDone && groupDrills.length > 0 &&
                    groupDrills.every((item) => item.completed) && (
                    <p className="training-complete-note">
                      ✓ Ejercicios de este objetivo completados.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {!!recommendations.length && (
        <section className="section-surface" data-reveal="up">
          <header className="champ-stats-head">
            <h3>Tu selección de campeones</h3>
            <span>Recomendaciones del plan semanal</span>
          </header>
          <div className="training-champions">
            {recommendations.map((item) => {
              const champion = /^(?:Priorizar|Evitar) (\S+)/.exec(item.title)
                ?.[1];
              return (
                <article
                  key={item.id}
                  className="training-champion"
                  data-reveal="up"
                >
                  {champion && (
                    <ChampionIcon
                      champion={champion}
                      version={assets.version}
                      className="mini-champ"
                    />
                  )}
                  <div>
                    <span className="teaser-label">
                      {item.type === "champion_priority"
                        ? "Priorizar"
                        : item.type === "champion_avoid"
                        ? "Limitar por ahora"
                        : "Recomendación"}
                    </span>
                    <h4>{item.title}</h4>
                    <p className="desc">{trainingCopy(item.description)}</p>
                    {explanation(item)}
                    {check(item, "He revisado la recomendación")}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {!!drills.length && (
        <section id="practice-map" className="section-surface" data-reveal="up">
          <header className="champ-stats-head">
            <h3>Lleva tu ejercicio a la Grieta</h3>
            <span>Zona orientativa de práctica</span>
          </header>
          <div className="section-body">
            <label className="practice-selector">
              Ejercicio a explorar<select
                className="rune-field"
                value={selected?.id ?? ""}
                onChange={(event) =>
                  setSelectedId(event.target.value)}
              >
                {drills.map((item) => (
                  <option key={item.id} value={item.id}>
                    {itemTitle(item)}
                    {item.completed ? " · Completado" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="practice-layout">
              <div className="practice-map">
                <Image
                  src="/maps/rift-template.png"
                  width={1400}
                  height={964}
                  alt="Mapa ilustrado con una zona sugerida para practicar el ejercicio seleccionado"
                />
                {selectedSpot && (
                  <div
                    className="practice-marker"
                    style={{
                      left: `${selectedSpot.x}%`,
                      top: `${selectedSpot.y}%`,
                    }}
                  >
                    <Tooltip
                      label={selectedSpot.label}
                      content={
                        <>
                          <strong className="tooltip-title">
                            {selectedSpot.label}
                          </strong>
                          <p className="tooltip-copy">
                            {selected && trainingCopy(selected.description)}
                          </p>
                        </>
                      }
                    >
                      <span className="practice-marker-dot">◎</span>
                    </Tooltip>
                  </div>
                )}
              </div>
              <div className="practice-checklist">
                <h3>{selected && itemTitle(selected)}</h3>
                <p className="desc">
                  {selected && trainingCopy(selected.description)}
                </p>
                <p className="page-sub">
                  {selectedSpot?.label ??
                    "Adapta este ejercicio a tu rol y a tu línea."}. La zona
                  señala dónde practicar; no representa un error observado en
                  una partida.
                </p>
                {selected && check(selected, "Marcar como completado")}
              </div>
            </div>
          </div>
        </section>
      )}
    </ScrollRevealRoot>
  );
}
