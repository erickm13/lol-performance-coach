import type { MapSuggestion, MatchEvent } from "./matches";
import type { MapPoint as Point } from "./riftProjection";
export { projectToTemplate } from "./riftProjection";

export type SuggestedDestination = Point & { description: string };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
function toward(from: Point, to: Point, maxDistance: number): Point {
  const length = distance(from, to);
  if (length === 0) return { ...from };
  const scale = Math.min(1, maxDistance / length);
  return {
    x: from.x + (to.x - from.x) * scale,
    y: from.y + (to.y - from.y) * scale,
  };
}
function validPoint(point: Point | null | undefined): point is Point {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}
export function suggestionTarget(
  event: MatchEvent,
  action: MapSuggestion["action"],
  teamId: number,
): SuggestedDestination {
  const from = event.position;
  const base = teamId === 100 ? { x: 1200, y: 1200 } : { x: 13800, y: 13800 };
  const snapshot = event.context?.snapshot;
  const recent = snapshot && snapshot.ageSeconds <= 15;
  const allies = recent
    ? snapshot.nearby.filter((player) =>
      player.side === "ally" && validPoint(player.position) &&
      distance(from, player.position) <= 3000
    )
    : [];
  allies.sort((a, b) =>
    distance(from, a.position!) - distance(from, b.position!)
  );
  if (action === "group" && allies.length) {
    return {
      ...allies[0].position!,
      description: `Posición previa de ${allies[0].champion}, ${
        snapshot!.ageSeconds
      } s antes. Puede haber cambiado al ocurrir el evento.`,
    };
  }
  if (action === "vision") {
    // A nearby objective in the timeline gives a concrete reference; no claim
    // that a ward was present or that the location is reachable/safe is made.
    const objective = [...(event.context?.objectives ?? [])]
      .filter((item) =>
        item.type === "ELITE_MONSTER_KILL" && validPoint(item.position) &&
        distance(from, item.position) <= 5000
      )
      .sort((a, b) =>
        Math.abs(a.secondsFromEvent) - Math.abs(b.secondsFromEvent)
      )[0];
    if (objective?.position) {
      return {
        ...toward(from, toward(objective.position, base, 700), 1800),
        description:
          "Entorno del objetivo registrado en este tramo. Zona de visión orientativa; no indica un ward observado ni una ruta segura.",
      };
    }
    // Local projection to the river diagonal, biased toward the player's side.
    // Unlike a single pit coordinate, this stays related to the event's area.
    const offset = (15000 - from.x - from.y) / 2;
    const river = { x: from.x + offset, y: from.y + offset };
    return {
      ...toward(from, toward(river, base, 650), 1500),
      description:
        "Zona orientativa hacia el río desde este evento. No confirma cobertura de visión, un lugar exacto para un ward ni una ruta segura.",
    };
  }
  return {
    ...toward(from, base, action === "retreat" ? 1600 : 1100),
    description: action === "retreat"
      ? "Dirección orientativa de repliegue hacia tu lado del mapa. La flecha no es una ruta navegable calculada."
      : "Reagrupamiento orientativo hacia tu lado del mapa. Sin posiciones aliadas recientes para señalar un compañero concreto.",
  };
}
export function mapArrow(from: Point, to: Point, endClearance = 35): string {
  const start = { x: from.x * 14, y: from.y * 9.64 };
  const target = { x: to.x * 14, y: to.y * 9.64 };
  const distance = Math.hypot(target.x - start.x, target.y - start.y);
  if (distance < 1) return "";
  // Leave enough curve outside nearby markers for the head to remain visible.
  const bend = Math.max(
    Math.min(100, distance * .35),
    distance < endClearance * 3 ? endClearance * 2 : 0,
  );
  const control = {
    x: (start.x + target.x) / 2,
    y: (start.y + target.y) / 2 + bend,
  };
  const pointAt = (t: number) => ({
    x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * target.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * target.y,
  });
  // Shorten the actual curve, preserving its tangent, instead of hiding its tip
  // beneath the destination's circle and dark backing.
  let endT = 1;
  for (let step = 1; step <= 100; step++) {
    endT = 1 - step / 100;
    const point = pointAt(endT);
    if (Math.hypot(point.x - target.x, point.y - target.y) >= endClearance) {
      break;
    }
  }
  const end = pointAt(endT);
  const trimmedControl = {
    x: start.x + (control.x - start.x) * endT,
    y: start.y + (control.y - start.y) * endT,
  };
  return `M ${start.x} ${start.y} Q ${trimmedControl.x} ${trimmedControl.y} ${end.x} ${end.y}`;
}
