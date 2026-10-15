"use client";
import { duration } from "../lib/matches";
import { CoachIcon } from "./CoachIcon";
import { CountUp } from "./CountUp";
import { useAiChat } from "./AiChatContext";
import { useMatchReview } from "./MatchReviewContext";

export function MatchCoachSummary() {
  const { coachName } = useAiChat();
  const { insights, loading, error, events, enabled, focusEvent } =
    useMatchReview();
  if (!enabled) return null;
  const complete = insights?.progress.complete ?? false;
  const good = insights?.goodPlays.find((item) =>
    Boolean(events[item.eventIndex])
  );
  // Confirmed mistakes precede hypotheses. This selects a concrete example,
  // not an invented severity ranking or a new model-generated conclusion.
  const suggestions =
    insights?.suggestions.filter((item) => Boolean(events[item.eventIndex])) ??
      [];
  const mistake = suggestions.find((item) => item.assessment === "error") ??
    suggestions[0];
  const pending = loading
    ? "El coach está revisando los eventos de la partida…"
    : error
    ? "El análisis está pausado. Los hallazgos completados se conservan."
    : "Este apartado se completará cuando avance el análisis.";
  const cards = [
    {
      kind: "good",
      label: "Un acierto",
      item: good,
      title: good?.title,
      copy: good?.explanation,
      empty: complete
        ? "El coach no identificó un acierto con evidencia suficiente en los eventos registrados."
        : pending,
    },
    {
      kind: "mistake",
      label: mistake?.assessment === "possible_error"
        ? "Riesgo a revisar"
        : "Un error a trabajar",
      item: mistake,
      title: mistake?.mistakeTitle,
      copy: mistake?.mistake,
      empty: complete
        ? "El coach no señaló errores con la evidencia disponible. Puedes explorar las evaluaciones de contexto en el mapa."
        : pending,
    },
    {
      kind: "practice",
      label: "Para tu próxima partida",
      item: mistake,
      title: mistake?.title,
      copy: mistake?.advice,
      empty: complete
        ? "Explora los momentos evaluados y conserva las decisiones que el coach reconoció como acertadas."
        : pending,
    },
  ];
  return (
    <section
      className="match-coach-summary"
      data-reveal="up"
      aria-labelledby="match-coach-heading"
    >
      <header className="match-coach-summary-head">
        <div>
          <CoachIcon />
          <h3 id="match-coach-heading">La lectura del {coachName}</h3>
        </div>
        <span>
          {complete ? "Análisis completo" : "Hallazgos hasta ahora"} ·{" "}
          <CountUp
            value={insights?.progress.evaluated ?? 0}
            startOnView
            durationMs={650}
            delayMs={0}
          />/<CountUp
            value={events.length}
            startOnView
            durationMs={650}
            delayMs={0}
          />{" "}
          eventos
        </span>
      </header>
      <div className="match-coach-summary-grid">
        {cards.map((card, index) => (
          <article
            key={card.kind}
            className={`match-coach-highlight ${card.kind}`}
            data-reveal="up"
            data-reveal-delay={String(index)}
          >
            <span className="teaser-label">{card.label}</span>
            {card.item
              ? (
                <>
                  <h4>{card.title}</h4>
                  <p>{card.copy}</p>
                  <button
                    type="button"
                    className="rune-link"
                    onClick={() => focusEvent(card.item!.eventIndex)}
                  >
                    Ver momento · {duration(
                      Math.floor(events[card.item.eventIndex].timestamp / 1000),
                    )} →
                  </button>
                </>
              )
              : <p className="match-coach-pending">{card.empty}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
