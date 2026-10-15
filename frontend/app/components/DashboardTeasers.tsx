"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

type Weakness = {
  id: string;
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
};

const SEVERITY_LABELS: Record<string, string> = { high: "Alta", medium: "Media", low: "Baja" };
const SEVERITY_CLASSES: Record<string, string> = {
  high: "text-ember",
  medium: "text-gold",
  low: "text-teal",
};
const CATEGORY_LABELS: Record<string, string> = {
  farming: "Farmeo",
  vision: "Visión",
  consistency: "Consistencia",
  objectives: "Participación en objetivos",
  early_game: "Juego temprano",
};

export function DashboardTeasers() {
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [hasPlan, setHasPlan] = useState(false);
  const [planItemCount, setPlanItemCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${getBackendUrl()}/riot/weaknesses`, { credentials: "include" }).then((r) =>
        r.json()
      ),
      fetch(`${getBackendUrl()}/riot/training-plan`, { credentials: "include" }).then((r) =>
        r.json()
      ),
    ])
      .then(([w, p]) => {
        setWeaknesses(w.weaknesses ?? []);
        setHasPlan(Boolean(p.plan));
        setPlanItemCount((p.items ?? []).length);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || weaknesses.length === 0) return null;

  const topWeakness = weaknesses[0];

  return (
    <div className="teaser-grid">
      <a
        href="/dashboard/debilidades"
        className="rune-panel teaser-card hover:bg-panel-line/20 transition-colors"
      >
        <span className="teaser-label">Debilidad más urgente</span>
        <h3 className={SEVERITY_CLASSES[topWeakness.severity]}>
          {SEVERITY_LABELS[topWeakness.severity]} — {CATEGORY_LABELS[topWeakness.category] ??
            topWeakness.category}
        </h3>
        <p className="desc">{topWeakness.description}</p>
        <span className="rune-link text-sm">Ver todas las debilidades →</span>
      </a>
      <a
        href="/dashboard/plan"
        className="rune-panel teaser-card hover:bg-panel-line/20 transition-colors"
      >
        <span className="teaser-label">Plan de esta semana</span>
        <h3>{hasPlan ? `${planItemCount} ítems` : "Todavía no generaste un plan"}</h3>
        <span className="rune-link text-sm">Ver plan completo →</span>
      </a>
    </div>
  );
}
