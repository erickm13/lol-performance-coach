"use client";
import { useRef, useState } from "react";
import { apiRequest, useResource } from "./useResource";
import type { PlanData } from "./training";
export function useTrainingPlan() {
  const resource = useResource<PlanData>("/riot/training-plan");
  const [updated, setUpdated] = useState<PlanData | null>(null);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const data = updated ?? resource.data;
  async function generate() {
    if (generatingRef.current || data?.plan) return;
    generatingRef.current = true;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      setUpdated(
        await apiRequest<PlanData>("/riot/training-plan", { method: "POST" }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar el plan. Intenta de nuevo.",
      );
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }
  async function complete(id: string) {
    if (
      !data || pendingRef.current.has(id) ||
      data.items.find((item) => item.id === id)?.completed
    ) return;
    pendingRef.current.add(id);
    setNotice(null);
    setPending([...pendingRef.current]);
    setErrors((old) => ({ ...old, [id]: "" }));
    try {
      await apiRequest(
        `/riot/training-plan/items/${encodeURIComponent(id)}/progress`,
        { method: "POST" },
      );
      setUpdated((current) => ({
        ...(current ?? data),
        items: (current ?? data).items.map((item) =>
          item.id === id ? { ...item, completed: true } : item
        ),
      }));
      setNotice("Progreso guardado. Tu plan semanal está actualizado.");
    } catch (err) {
      setErrors((old) => ({
        ...old,
        [id]: err instanceof Error
          ? err.message
          : "No se pudo guardar. Intenta de nuevo.",
      }));
    } finally {
      pendingRef.current.delete(id);
      setPending([...pendingRef.current]);
    }
  }
  return {
    ...resource,
    data,
    generate,
    complete,
    generating,
    pending,
    itemErrors: errors,
    mutationError: error,
    notice,
  };
}
