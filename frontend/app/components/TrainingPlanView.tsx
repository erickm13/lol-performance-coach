"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

type PlanItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  llmExplanation: string | null;
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

  async function load() {
    try {
      const res = await fetch(`${getBackendUrl()}/riot/training-plan`, {
        credentials: "include",
      });
      const data = await res.json();
      setPlan(data.plan ?? null);
      setItems(data.items ?? []);
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
      }
      setPlan(data.plan ?? null);
      setItems(data.items ?? []);
    } catch {
      setMessage("No se pudo generar el plan. Intentá de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleComplete(itemId: string) {
    try {
      await fetch(
        `${getBackendUrl()}/riot/training-plan/items/${itemId}/progress`,
        { method: "POST", credentials: "include" },
      );
      setCompletedIds((prev) => [...prev, itemId]);
    } catch {
      // Sin conexión: el usuario puede reintentar con el mismo botón.
    }
  }

  if (!loaded) {
    return <p className="text-mist">Cargando...</p>;
  }

  return (
    <div className="rune-stagger flex flex-col gap-6 w-full max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-display text-xl font-semibold">
          Plan de entrenamiento semanal
        </h1>
        {!plan && (
          <button onClick={handleGenerate} disabled={generating} className="rune-btn">
            {generating ? "Generando..." : "Generar plan de esta semana"}
          </button>
        )}
      </div>

      {message && <p className="text-mist text-sm">{message}</p>}

      {items.map((item) => {
        const done = completedIds.includes(item.id);
        return (
          <section key={item.id} className="rune-panel p-6 flex flex-col gap-2">
            <span className="text-mist text-xs uppercase tracking-wide">
              {TYPE_LABELS[item.type] ?? item.type}
            </span>
            <h2 className="font-display font-semibold">{item.title}</h2>
            <p className="text-mist text-sm leading-relaxed">
              {item.llmExplanation ?? item.description}
            </p>
            <button
              onClick={() => handleComplete(item.id)}
              disabled={done}
              className="rune-btn self-start mt-2"
            >
              {done ? "Completado" : "Marcar completado"}
            </button>
          </section>
        );
      })}
    </div>
  );
}
