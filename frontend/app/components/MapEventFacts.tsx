import { duration, type MatchEvent } from "../lib/matches";
import { Fragment } from "react";
import { CountUp } from "./CountUp";
export function MapEventFacts(
  { event, expanded = false }: { event: MatchEvent; expanded?: boolean },
) {
  const context = event.context;
  if (!context) {
    return (
      <p className="tooltip-caption">
        Momento de la partida: {duration(Math.floor(event.timestamp / 1000))}.
      </p>
    );
  }
  const snap = context.snapshot;
  const opponent = snap?.opponentByRole;
  const stats = snap
    ? [
      snap.self.level === null ? null : (
        <span key="level">
          Nivel <CountUp value={snap.self.level} startOnView />
        </span>
      ),
      snap.self.healthPercent === null ? null : (
        <CountUp
          key="health"
          value={snap.self.healthPercent}
          from={100}
          suffix="% vida"
          startOnView
        />
      ),
      snap.self.unspentGold === null ? null : (
        <CountUp
          key="gold"
          value={snap.self.unspentGold}
          useGrouping
          suffix=" oro sin gastar"
          startOnView
        />
      ),
      snap.self.cs === null
        ? null
        : <CountUp key="cs" value={snap.self.cs} suffix=" CS" startOnView />,
    ].filter(Boolean)
    : [];
  return (
    <div className="map-event-facts">
      <p>
        {event.kind === "death"
          ? (
            <>
              Rival:{" "}
              <strong>
                {context.killer ?? "Fuente sin campeón identificado"}
              </strong>
            </>
          )
          : (
            <>
              Víctima: <strong>{context.victim ?? "No identificada"}</strong>
            </>
          )}
        {!!context.assistants.length && (
          <span>· Asistencias: {context.assistants.join(", ")}</span>
        )}
      </p>
      <p>
        Tu marcador antes:{" "}
        <strong>
          <CountUp value={context.scoreBefore.kills} startOnView /> /{" "}
          <CountUp value={context.scoreBefore.deaths} startOnView /> /{" "}
          <CountUp value={context.scoreBefore.assists} startOnView />
        </strong>
      </p>
      {snap && (
        <div className="map-snapshot-facts">
          <span className="map-fact-time">
            Registro a {duration(Math.floor(snap.timestamp / 1000))}
            {snap.ageSeconds
              ? ` · ${snap.ageSeconds} s antes`
              : " · registro más reciente"}
          </span>
          {!!stats.length && (
            <p>
              {stats.map((stat, index) => (
                <Fragment key={index}>{index > 0 && " · "}{stat}</Fragment>
              ))}
            </p>
          )}
          {opponent && (
            <p>
              Frente a {opponent.champion}{" "}
              (mismo rol){opponent.goldDifference !== null && (
                <>
                  {": "}
                  <CountUp
                    value={opponent.goldDifference}
                    prefix={opponent.goldDifference > 0 ? "+" : ""}
                    useGrouping
                    suffix=" oro"
                    startOnView
                  />
                </>
              )}
              {opponent.csDifference !== null && (
                <>
                  {" · "}
                  <CountUp
                    value={opponent.csDifference}
                    prefix={opponent.csDifference > 0 ? "+" : ""}
                    useGrouping
                    suffix=" CS"
                    startOnView
                  />
                </>
              )}
            </p>
          )}
          {expanded && !!snap.nearby.length && (
            <p>
              En ese registro, a ≤2000 unidades: {snap.nearby.map((p) =>
                `${p.champion} (${p.side === "ally" ? "aliado" : "rival"})`
              ).join(", ")}. Estas posiciones pueden haber cambiado.
            </p>
          )}
        </div>
      )}
      {expanded && (
        <>
          <p>
            Wards en los 120 s anteriores: tú{" "}
            <CountUp value={context.wardsLast120s.selfPlaced} startOnView />, tu
            equipo{" "}
            <CountUp value={context.wardsLast120s.teamPlaced} startOnView />. No
            representa la cobertura activa.
          </p>
          {!!context.nearbyKills.length && (
            <div>
              <p>Bajas cercanas en ±15 s:</p>
              {context.nearbyKills.slice(0, 4).map((kill, i) => (
                <p key={i}>
                  {kill.secondsFromEvent > 0 ? "+" : ""}
                  {kill.secondsFromEvent} s · {kill.killer ?? "Entorno"} →{" "}
                  {kill.victim ?? "Campeón"}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
