"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

type Weakness = {
  id: string;
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
  evidence?: string[];
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

const BADGE_CLASSES: Record<string, string> = {
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
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
    <div>
      <div className="page-head">
        <div>
          <h2>Debilidades detectadas</h2>
          <p className="page-sub">
            Basado en tus últimas partidas de cola clasificatoria solo/dúo.
          </p>
        </div>
      </div>

      {!loaded && <p className="text-mist">Cargando...</p>}

      {loaded && weaknesses.length === 0 && (
        <p className="text-mist text-sm">
          Todavía no detectamos patrones — hace falta al menos 10 partidas guardadas.
        </p>
      )}

      <div className="card-list rune-stagger">
        {weaknesses.map((w) => (
          <div key={w.id} className="rune-panel weakness-card">
            <div className="weakness-card-head">
              <h3>{CATEGORY_LABELS[w.category] ?? w.category}</h3>
              <span className={`badge ${BADGE_CLASSES[w.severity] ?? "badge-low"}`}>
                Severidad {SEVERITY_LABELS[w.severity] ?? w.severity}
              </span>
            </div>
            <p className="desc">{w.description}</p>
            {w.evidence && w.evidence.length > 0 && (
              <div className="evidence">Evidencia: {w.evidence.join(" · ")}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
