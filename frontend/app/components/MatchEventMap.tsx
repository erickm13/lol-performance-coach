"use client";
import { AcademyText } from "./AcademyText";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import {
  duration,
  type GoodPlay,
  type MapSuggestion,
  type MatchEvent,
} from "../lib/matches";
import { mapArrow, projectToTemplate, suggestionTarget } from "../lib/riftMap";
import { Tooltip } from "./Tooltip";
import { CoachIcon } from "./CoachIcon";
import { CountUp } from "./CountUp";
import { MapEventFacts } from "./MapEventFacts";
import { useAiChat } from "./AiChatContext";
import {
  inReviewPhase,
  type ReviewFilter,
  useMatchReview,
} from "./MatchReviewContext";

const PHASES = [
  { value: "all", label: "Toda la partida" },
  { value: "early", label: "Inicio · 0–10 min" },
  { value: "mid", label: "Medio · 10–20 min" },
  { value: "late", label: "Final · 20+ min" },
] as const;
const LABELS = { death: "Muerte", kill: "Asesinato", assist: "Asistencia" };
const ACTION_LABELS = {
  retreat: "Alternativa de retirada",
  vision: "Zona para preparar visión",
  group: "Zona para considerar agrupamiento",
};
function eventTime(event: MatchEvent) {
  return duration(Math.floor(event.timestamp / 1000));
}
function countWords(count: number, feminine = false): string {
  const small = [
    "cero",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciséis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
    "veinte",
    "veintiuno",
    "veintidós",
    "veintitrés",
    "veinticuatro",
    "veinticinco",
    "veintiséis",
    "veintisiete",
    "veintiocho",
    "veintinueve",
  ];
  const words = count < 30 ? small[count] : count < 100
    ? `${
      [
        "",
        "",
        "",
        "treinta",
        "cuarenta",
        "cincuenta",
        "sesenta",
        "setenta",
        "ochenta",
        "noventa",
      ][Math.floor(count / 10)]
    }${count % 10 ? ` y ${small[count % 10]}` : ""}`
    : String(count);
  const agreed = feminine
    ? words.replace(/uno$/, "una")
    : words.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
  return agreed.charAt(0).toUpperCase() + agreed.slice(1);
}
function CoachEventReview(
  { coachName, event, mistake, good, observation, expanded = false }: {
    coachName: string;
    event: MatchEvent;
    mistake?: MapSuggestion;
    good?: GoodPlay;
    observation?: GoodPlay;
    expanded?: boolean;
  },
) {
  return (
    <div
      className={`coach-event-review ${
        mistake ? "mistake" : good ? "good" : "context"
      }`}
    >
      <strong className="tooltip-title">
        {coachName} · {eventTime(event)}
      </strong>
      {mistake
        ? (
          <>
            <h4>
              {mistake.assessment === "possible_error"
                ? "Posible error"
                : "Error"}: {mistake.mistakeTitle}
            </h4>
            <p className="tooltip-copy"><AcademyText text={mistake.mistake} /></p>
          </>
        )
        : good
        ? (
          <>
            <h4>Buena jugada: {good.title}</h4>
            <p className="tooltip-copy"><AcademyText text={good.explanation} /></p>
          </>
        )
        : observation
        ? (
          <>
            <h4>Evaluación: {observation.title}</h4>
            <p className="tooltip-copy"><AcademyText text={observation.explanation} /></p>
          </>
        )
        : <h4>{LABELS[event.kind]}</h4>}
      {mistake || good || observation
        ? (
          <details className="coach-event-evidence">
            <summary>Datos del momento</summary>
            <MapEventFacts event={event} expanded={expanded} />
          </details>
        )
        : <MapEventFacts event={event} expanded={expanded} />}
    </div>
  );
}

export function MatchEventMap() {
  const {
    events,
    teamId,
    filter,
    setFilter,
    phase,
    setPhase,
    selected,
    setSelected,
    insights,
    loading,
    error,
    retrySeconds,
    autoResume,
    retryAnalysis,
  } = useMatchReview();
  const { coachName } = useAiChat();
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState(960);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setMapWidth(entry.contentRect.width);
    });
    observer.observe(map);
    return () => observer.disconnect();
  }, []);
  const mapUnitsPerPixel = 1400 / mapWidth;
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const arrowId = `map-arrow-${useId().replace(/:/g, "")}`;
  const suggestions = (insights?.suggestions ?? []).filter((suggestion) =>
    Boolean(events[suggestion.eventIndex]) &&
    typeof suggestion.mistake === "string" &&
    typeof suggestion.mistakeTitle === "string"
  );
  const goodPlays = (insights?.goodPlays ?? []).filter((play) =>
    Boolean(events[play.eventIndex])
  );
  const observations = (insights?.observations ?? []).filter((review) =>
    Boolean(events[review.eventIndex])
  );
  const mistakesByEvent = new Map(
    suggestions.map((suggestion) => [suggestion.eventIndex, suggestion]),
  );
  const goodByEvent = new Map(goodPlays.map((play) => [play.eventIndex, play]));
  const observationsByEvent = new Map(
    observations.map((review) => [review.eventIndex, review]),
  );
  const evaluatedCount = suggestions.length + goodPlays.length +
    observations.length;
  const complete = insights?.progress.complete ?? events.length === 0;
  const visible = events.map((event, index) => ({ ...event, index })).filter(
    (event) => {
      const mistake = mistakesByEvent.has(event.index);
      const good = goodByEvent.has(event.index);
      const evaluated = mistake || good || observationsByEvent.has(event.index);
      return evaluated && inReviewPhase(event.timestamp, phase) &&
        (filter === "all" ||
          (filter === "highlights"
            ? mistake || good
            : filter === "mistake"
            ? mistake
            : good));
    },
  );
  const visibleIds = new Set(visible.map((event) => event.index));
  const shownSuggestions = suggestions.filter((suggestion) =>
    visibleIds.has(suggestion.eventIndex)
  );
  const selectedEvent = selected === null || !visibleIds.has(selected)
    ? null
    : events[selected];
  const selectedPosition = visible.findIndex((event) =>
    event.index === selected
  );
  const phaseTotal =
    events.filter((event) => inReviewPhase(event.timestamp, phase)).length;
  const emptyMessage = phaseTotal === 0
    ? "No hay eventos registrados en este tramo."
    : !complete
    ? "El coach está evaluando los eventos de este tramo. El progreso queda guardado."
    : "No hay eventos que coincidan con estos filtros.";
  return (
    <div className="template-map-content">
      <div className="template-map-toolbar" data-reveal="up">
        <label className="field-label" htmlFor="map-event-filter">
          Mostrar<select
            id="map-event-filter"
            className="rune-field"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as ReviewFilter);
              setSelected(null);
            }}
          >
            <option value="highlights">
              Análisis del coach
            </option>
            <option value="all">Todos los eventos</option>
            <option value="mistake">
              Errores señalados
            </option>
            <option value="good">
              Buenas jugadas
            </option>
          </select>
        </label>
        <div className="map-coach-status" aria-live="polite">
          <CoachIcon />
          {loading
            ? (
              <span>
                {coachName} está analizando tus jugadas…{" "}
                <CountUp
                  value={evaluatedCount}
                  startOnView
                  durationMs={600}
                  delayMs={0}
                />/<CountUp
                  value={events.length}
                  startOnView
                  durationMs={600}
                  delayMs={0}
                />{" "}
                evaluadas
              </span>
            )
            : error
            ? (
              <>
                <span>
                  {coachName}: {error} ·{" "}
                  <CountUp
                    value={evaluatedCount}
                    startOnView
                    durationMs={600}
                    delayMs={0}
                  />/<CountUp
                    value={events.length}
                    startOnView
                    durationMs={600}
                    delayMs={0}
                  />{" "}
                  evaluadas
                </span>
                <button
                  className="rune-link"
                  disabled={retrySeconds > 0}
                  onClick={retryAnalysis}
                >
                  {retrySeconds > 0
                    ? `${
                      autoResume ? "Continuará" : "Reintentar"
                    } en ${retrySeconds} s`
                    : "Reintentar"}
                </button>
              </>
            )
            : (
              <>
                <span>
                  {suggestions.length
                    ? `${countWords(suggestions.length)} ${
                      suggestions.length === 1 ? "consejo" : "consejos"
                    } del ${coachName}`
                    : goodPlays.length
                    ? `${countWords(goodPlays.length, true)} ${
                      goodPlays.length === 1 ? "buena jugada" : "buenas jugadas"
                    } del ${coachName}`
                    : `${coachName} evaluó todos los eventos con observaciones de contexto.`}
                </span>
                <span>
                  <CountUp
                    value={evaluatedCount}
                    startOnView
                    durationMs={600}
                    delayMs={0}
                  />/<CountUp
                    value={events.length}
                    startOnView
                    durationMs={600}
                    delayMs={0}
                  />{" "}
                  evaluadas
                </span>
              </>
            )}
        </div>
      </div>
      {!complete && (
        <p className="map-caption" role="status">
          <CountUp
            value={evaluatedCount}
            startOnView
            durationMs={600}
            delayMs={0}
          />{" "}
          de{" "}
          <CountUp
            value={events.length}
            startOnView
            durationMs={600}
            delayMs={0}
          />{" "}
          eventos evaluados. Cada punto aparece con su análisis del{" "}
          {coachName}; el progreso queda guardado.
        </p>
      )}
      <div className="map-time-controls" data-reveal="up">
        <div
          className="map-phase-buttons"
          role="group"
          aria-label="Filtrar eventos por fase de partida"
        >
          {PHASES.map((item) => {
            const count = events.filter((event) =>
              inReviewPhase(event.timestamp, item.value)
            ).length;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={phase === item.value}
                disabled={item.value !== "all" && count === 0}
                onClick={() =>
                  setPhase(item.value)}
              >
                {item.label}
                <span aria-label={`${count} eventos registrados`}>
                  <CountUp
                    value={count}
                    startOnView
                    durationMs={650}
                    delayMs={0}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <div className="map-selection-status">
          <span>
            <CountUp
              value={visible.length}
              startOnView
              durationMs={600}
              delayMs={0}
            />{" "}
            de{" "}
            <CountUp
              value={phaseTotal}
              startOnView
              durationMs={600}
              delayMs={0}
            />{" "}
            eventos visibles en este tramo
          </span>
          {selectedEvent && (
            <button
              className="rune-link"
              type="button"
              onClick={() => setSelected(null)}
            >
              Quitar selección
            </button>
          )}
        </div>
      </div>
      <div className="map-review-layout">
        <div className="map-canvas-column" data-reveal="scale">
          <div
            className={`map-zoom-viewport zoom-enabled${
              selectedEvent ? " has-selection" : ""
            }`}
          >
            <div
              className="template-match-map"
              ref={mapRef}
              aria-label="Mapa ilustrado de la partida con momentos y sugerencias del coach"
            >
              <Image
                className="template-rift-image"
                src="/maps/rift-template.png"
                width={1400}
                height={964}
                alt="La Grieta del Invocador, mapa del template Hextech"
                sizes="(max-width: 960px) 100vw, 960px"
                priority
              />
              <svg
                className="template-map-arrows"
                viewBox="0 0 1400 964"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id={arrowId}
                    markerUnits="userSpaceOnUse"
                    viewBox="0 0 24 20"
                    markerWidth={22 * mapUnitsPerPixel}
                    markerHeight={18 * mapUnitsPerPixel}
                    refX="24"
                    refY="10"
                    overflow="visible"
                    orient="auto-start-reverse"
                  >
                    <path
                      className="map-arrow-head"
                      d="M0,0 L24,10 L0,20 L5,10 Z"
                    />
                  </marker>
                </defs>
                {shownSuggestions.map((suggestion) => {
                  const event = events[suggestion.eventIndex];
                  const from = projectToTemplate(event.position);
                  const to = projectToTemplate(
                    suggestionTarget(event, suggestion.action, teamId),
                  );
                  const path = mapArrow(from, to, 25 * mapUnitsPerPixel);
                  const gradientId =
                    `${arrowId}-gradient-${suggestion.eventIndex}`;
                  return (
                    <g
                      key={suggestion.eventIndex}
                      className={`map-arrow-group${
                        selected === suggestion.eventIndex ? " selected" : ""
                      }`}
                    >
                      <defs>
                        <linearGradient
                          id={gradientId}
                          spreadMethod="repeat"
                          gradientUnits="userSpaceOnUse"
                          x1={from.x * 14}
                          y1={from.y * 9.64}
                          x2={to.x * 14}
                          y2={to.y * 9.64}
                        >
                          <stop offset="0%" stopColor="#aa2030" />
                          <stop offset="25%" stopColor="#e7353b" />
                          <stop offset="50%" stopColor="#ff6860" />
                          <stop offset="75%" stopColor="#e7353b" />
                          <stop offset="100%" stopColor="#aa2030" />
                          {!reducedMotion && (
                            <animateTransform
                              attributeName="gradientTransform"
                              type="translate"
                              from="0 0"
                              to={`${(to.x - from.x) * 14} ${
                                (to.y - from.y) * 9.64
                              }`}
                              dur="3s"
                              repeatCount="indefinite"
                            />
                          )}
                        </linearGradient>
                      </defs>
                      <path className="map-arrow-halo" d={path} />
                      <path
                        className="map-arrow-glow"
                        d={path}
                        style={{ stroke: `url(#${gradientId})` }}
                      />
                      <path
                        className="template-map-arrow"
                        d={path}
                        style={{ stroke: `url(#${gradientId})` }}
                        markerEnd={`url(#${arrowId})`}
                      />
                    </g>
                  );
                })}
              </svg>
              {visible.map((event) => {
                const point = projectToTemplate(event.position);
                const mistake = mistakesByEvent.get(event.index);
                const good = goodByEvent.get(event.index);
                const observation = observationsByEvent.get(event.index);
                const color = mistake ? "mistake" : good ? "good" : "context";
                return (
                  <div
                    key={event.index}
                    className={`template-map-marker ${color}${
                      selected === event.index ? " selected" : ""
                    }`}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  >
                    <Tooltip
                      label={`${coachName}: ${
                        mistake?.mistakeTitle ?? good?.title ??
                          observation?.title ?? LABELS[event.kind]
                      } · ${eventTime(event)}`}
                      popupClassName="match-map-tooltip"
                      onActivate={() => setSelected(event.index)}
                      dismissOnActivate
                      pressed={selected === event.index}
                      controls="map-selected-review"
                      content={
                        <CoachEventReview
                          coachName={coachName}
                          event={event}
                          mistake={mistake}
                          good={good}
                          observation={observation}
                        />
                      }
                    >
                      <span className="template-marker-core" />
                    </Tooltip>
                  </div>
                );
              })}
              {shownSuggestions.map((suggestion) => {
                const event = events[suggestion.eventIndex];
                const destination = suggestionTarget(
                  event,
                  suggestion.action,
                  teamId,
                );
                const point = projectToTemplate(destination);
                return (
                  <div
                    key={`suggestion-${suggestion.eventIndex}`}
                    className={`template-map-marker suggestion${
                      selected === suggestion.eventIndex ? " selected" : ""
                    }`}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  >
                    <Tooltip
                      label={`${coachName}: mejor jugada sugerida · ${suggestion.title}`}
                      popupClassName="match-map-tooltip suggestion"
                      onActivate={() => setSelected(suggestion.eventIndex)}
                      dismissOnActivate
                      pressed={selected === suggestion.eventIndex}
                      controls="map-selected-review"
                      content={
                        <>
                          <strong className="tooltip-title">
                            {coachName} · Mejor jugada sugerida ·{" "}
                            {eventTime(event)}
                          </strong>
                          <p className="map-tip-heading">{suggestion.title}</p>
                          <p className="tooltip-copy"><AcademyText text={suggestion.advice} /></p>
                          <p className="tooltip-caption">
                            {ACTION_LABELS[suggestion.action]} ·{" "}
                            {destination.description}
                          </p>
                        </>
                      }
                    >
                      <span className="template-marker-core" />
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="template-map-legend" data-reveal="up">
            <span>
              <i className="legend-event mistake" />Error señalado
            </span>
            <span>
              <i className="legend-event good" />Buena jugada
            </span>
            <span>
              <i className="legend-event suggestion" />Alternativa del{" "}
              {coachName}
            </span>
            {visible.some((event) =>
              !mistakesByEvent.has(event.index) && !goodByEvent.has(event.index)
            ) && (
              <span>
                <i className="legend-event context" />Evaluación contextual
              </span>
            )}
          </div>
          <p className="map-caption">
            Los puntos marcan el lugar de la baja, también en las asistencias.
            {" "}
            {coachName}{" "}
            propone alternativas orientativas; las flechas no representan
            trayectos observados.
          </p>
        </div>
        <aside
          id="map-selected-review"
          data-reveal="fade"
          className={`map-moment-advice map-review-panel ${
            selectedEvent
              ? mistakesByEvent.has(selected!)
                ? "mistake"
                : goodByEvent.has(selected!)
                ? "good"
                : "context"
              : ""
          }`}
          aria-labelledby="map-review-heading"
          tabIndex={-1}
        >
          <header className="map-review-panel-head">
            <h4 id="map-review-heading">
              <CoachIcon />Momento seleccionado
            </h4>
            <span role="status">
              {selectedEvent
                ? `${eventTime(selectedEvent)} · ${
                  selectedPosition + 1
                }/${visible.length}`
                : "Explora tu partida"}
            </span>
          </header>
          {selectedEvent
            ? (
              <div key={selected} data-reveal="up">
                <CoachEventReview
                  coachName={coachName}
                  event={selectedEvent}
                  mistake={mistakesByEvent.get(selected!)}
                  good={goodByEvent.get(selected!)}
                  observation={observationsByEvent.get(selected!)}
                  expanded
                />
                {mistakesByEvent.has(selected!) && (
                  <div className="coach-selected-alternative">
                    <span className="teaser-label">
                      Mejor jugada sugerida por {coachName}
                    </span>
                    <h4>{mistakesByEvent.get(selected!)!.title}</h4>
                    <p>{mistakesByEvent.get(selected!)!.advice}</p>
                  </div>
                )}
              </div>
            )
            : (
              <p>
                Selecciona un punto: {coachName}{" "}
                explica el error en rojo, la alternativa en amarillo y el
                acierto en azul.
              </p>
            )}

          {!selectedEvent && visible.length > 0 && (
            <button
              className="rune-link"
              type="button"
              onClick={() => setSelected(visible[0].index)}
            >
              Ver primer evento →
            </button>
          )}
          {selectedEvent && (
            <div
              className="map-event-navigation"
              aria-label="Recorrer eventos visibles"
            >
              <button
                type="button"
                className="btn-outline"
                disabled={selectedPosition <= 0}
                onClick={() => setSelected(visible[selectedPosition - 1].index)}
              >
                ← Anterior
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={selectedPosition < 0 ||
                  selectedPosition >= visible.length - 1}
                onClick={() => setSelected(visible[selectedPosition + 1].index)}
              >
                Siguiente →
              </button>
            </div>
          )}
          {!visible.length && <p>{emptyMessage}</p>}
        </aside>
      </div>
      <details className="map-moment-details" data-reveal="up" open>
        <summary>
          Revisar momentos de la partida{" "}
          <span>
            <CountUp
              value={visible.length}
              startOnView
              durationMs={600}
              delayMs={0}
            />{" "}
            visibles ·{" "}
            <CountUp
              value={evaluatedCount}
              startOnView
              durationMs={600}
              delayMs={0}
            />/<CountUp
              value={events.length}
              startOnView
              durationMs={600}
              delayMs={0}
            />{" "}
            evaluados
          </span>
        </summary>
        <div className="event-list map-review-events">
          {visible.length
            ? visible.map((event) => (
              <button
                key={event.index}
                data-reveal="up"
                className={`event-list-row ${
                  selected === event.index ? "active" : ""
                }`}
                type="button"
                aria-pressed={selected === event.index}
                aria-controls="map-selected-review"
                onClick={() => setSelected(event.index)}
              >
                <span
                  className={`event-dot ${
                    mistakesByEvent.has(event.index)
                      ? "mistake"
                      : goodByEvent.has(event.index)
                      ? "good"
                      : "context"
                  }`}
                />
                <span>
                  {mistakesByEvent.get(event.index)?.mistakeTitle ??
                    goodByEvent.get(event.index)?.title ??
                    observationsByEvent.get(event.index)?.title ??
                    LABELS[event.kind]}
                </span>
                <time>{eventTime(event)}</time>
              </button>
            ))
            : (
              <p className="page-sub">
                {emptyMessage}
              </p>
            )}
        </div>
      </details>
    </div>
  );
}
