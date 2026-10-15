"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

type PlanItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  llmExplanation: string | null;
  completed?: boolean;
};

type Plan = { id: string; generatedBy: string } | null;

const TYPE_LABELS: Record<string, string> = {
  focus_area: "Foco de la semana",
  drill: "Ejercicio",
  champion_avoid: "Evitar",
  champion_priority: "Priorizar",
};

export function TrainingPlanView() {
  const [plan, setPlan] = useState<Plan>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  async function load() {
    try {
      const res = await fetch(`${getBackendUrl()}/riot/training-plan`, {
        credentials: "include",
      });
      const data = await res.json();
      const fetchedItems: PlanItem[] = data.items ?? [];
      setPlan(data.plan ?? null);
      setItems(fetchedItems);
      setCompletedIds(
        fetchedItems.filter((item) => item.completed).map((item) => item.id),
      );
    } catch {
      // Sin conexión: el usuario puede reintentar.
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`${getBackendUrl()}/riot/training-plan`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.message) {
        setMessage(data.message);
      } else if (data.error) {
        setMessage(data.error);
      }
      setPlan(data.plan ?? null);
      setItems(data.items ?? []);
      setCompletedIds(
        (data.items ?? [])
          .filter((item: PlanItem) => item.completed)
          .map((item: PlanItem) => item.id),
      );
    } catch {
      setMessage("No se pudo generar el plan. Intentá de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleComplete(itemId: string) {
    try {
      const res = await fetch(
        `${getBackendUrl()}/riot/training-plan/items/${itemId}/progress`,
        { method: "POST", credentials: "include" },
      );
      if (res.ok) {
        setCompletedIds((prev) => [...prev, itemId]);
        setItemErrors((prev) => {
          const updated = { ...prev };
          delete updated[itemId];
          return updated;
        });
      } else {
        const data = await res.json();
        setItemErrors((prev) => ({
          ...prev,
          [itemId]: data.error || "No se pudo marcar el ítem como completado.",
        }));
      }
    } catch {
      setItemErrors((prev) => ({
        ...prev,
        [itemId]: "Error de conexión. Intentá de nuevo.",
      }));
    }
  }

  if (!loaded) {
    return <p className="text-mist">Cargando...</p>;
  }

  const doneCount = items.filter((item) => completedIds.includes(item.id)).length;
  const progress = items.length > 0
    ? Math.round((doneCount / items.length) * 100)
    : 0;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Plan de entrenamiento semanal</h2>
          <p className="page-sub">
            Ejercicios anclados a las métricas de tus últimas partidas.
          </p>
        </div>
        {!plan && (
          <button onClick={handleGenerate} disabled={generating} className="rune-btn">
            {generating ? "Generando..." : "Generar plan de esta semana"}
          </button>
        )}
      </div>

      {message && <p className="text-mist text-sm mb-4">{message}</p>}

      {items.length > 0 && (
        <div className="plan-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-label tabular">
            {doneCount} de {items.length} completados
          </span>
        </div>
      )}

      <div className="card-list rune-stagger">
        {items.map((item) => {
          const done = completedIds.includes(item.id);
          const error = itemErrors[item.id];
          return (
            <div
              key={item.id}
              className={`rune-panel plan-item ${done ? "done" : ""}`}
            >
              <button
                type="button"
                onClick={() => handleComplete(item.id)}
                disabled={done}
                aria-label={done ? "Completado" : "Marcar completado"}
                className={`plan-check ${done ? "done" : ""}`}
              >
                {done ? "✓" : ""}
              </button>
              <div className="min-w-0">
                <span className="teaser-label">
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>
                <h3>{item.title}</h3>
                <p className="desc">{item.description}</p>
                {item.llmExplanation && (
                  <p className="plan-explain">Por qué: {item.llmExplanation}</p>
                )}
                {error && <p className="text-ember text-sm mt-2">{error}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
