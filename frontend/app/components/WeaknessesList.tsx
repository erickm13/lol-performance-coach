"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

type Weakness = {
  id: string;
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
};

const CATEGORY_LABELS: Record<string, string> = {
  farming: "Farmeo",
  vision: "Visión",
  consistency: "Consistencia",
  objectives: "Participación en objetivos",
  early_game: "Juego temprano",
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const SEVERITY_CLASSES: Record<string, string> = {
  high: "text-ember border-ember/40",
  medium: "text-gold border-gold/40",
  low: "text-teal border-teal/40",
};

export function WeaknessesList() {
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${getBackendUrl()}/riot/weaknesses`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setWeaknesses(data.weaknesses ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="rune-stagger flex flex-col gap-6 w-full max-w-3xl">
      <h1 className="font-display text-xl font-semibold">Debilidades detectadas</h1>

      {!loaded && <p className="text-mist">Cargando...</p>}

      {loaded && weaknesses.length === 0 && (
        <p className="text-mist text-sm">
          Todavía no detectamos patrones — hace falta al menos 10 partidas guardadas.
        </p>
      )}

      {weaknesses.map((w) => (
        <section key={w.id} className="rune-panel p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display font-semibold">
              {CATEGORY_LABELS[w.category] ?? w.category}
            </h2>
            <span
              className={`text-xs font-medium uppercase tracking-wide border px-2 py-1 ${
                SEVERITY_CLASSES[w.severity]
              }`}
            >
              Severidad {SEVERITY_LABELS[w.severity] ?? w.severity}
            </span>
          </div>
          <p className="text-mist text-sm">{w.description}</p>
        </section>
      ))}
    </div>
  );
}
