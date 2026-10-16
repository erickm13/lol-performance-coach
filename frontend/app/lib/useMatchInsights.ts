"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "./useResource";
import type { MapInsights } from "./matches";

export function useMatchInsights(
  matchId: string,
  filter: string,
  enabled: boolean,
) {
  const [insights, setInsights] = useState<MapInsights | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [retry, setRetry] = useState(0);
  const [autoResume, setAutoResume] = useState(false);
  const rateLimitAttempts = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!enabled) {
      setLoading(false);
      setInsights(null);
      setError(null);
      setRetryAt(0);
      setAutoResume(false);
      return;
    }
    setLoading(true);
    setError(null);
    setRetryAt(0);
    setAutoResume(false);
    // Each response commits a complete batch. Preserve it when changing filters
    // or retrying, and ask only for events the server has not evaluated yet.
    async function analyzeAll() {
      let lastEvaluated = -1;
      try {
        while (!controller.signal.aborted) {
          const data = await apiRequest<MapInsights>(
            `/riot/matches/${
              encodeURIComponent(matchId)
            }/insights?focus=${filter}`,
            { method: "POST", signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          if (
            !Number.isInteger(data.version) || data.version < 4 || !data.progress ||
            !Array.isArray(data.observations)
          ) {
            throw new Error(
              "Actualiza el backend para analizar todos los eventos de la partida.",
            );
          }
          setInsights(data);
          rateLimitAttempts.current = 0;
          if (data.progress.complete) return;
          if (data.progress.evaluated <= lastEvaluated) {
            throw new Error(
              "El análisis no avanzó. Puedes continuar desde el progreso guardado.",
            );
          }
          lastEvaluated = data.progress.evaluated;
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        const failure = cause as Error & {
          code?: string;
          retryAfterSeconds?: number;
          partial?: MapInsights;
        };
        if (
          failure.partial && Number.isInteger(failure.partial.version) &&
          failure.partial.version >= 4 && failure.partial.progress &&
          Array.isArray(failure.partial.observations)
        ) {
          setInsights(failure.partial);
        }
        const retrySeconds = Number(failure.retryAfterSeconds);
        if (
          failure.code === "rate_limit" && Number.isFinite(retrySeconds) &&
          retrySeconds > 0
        ) {
          const receivedAt = Date.now();
          setNow(receivedAt);
          setRetryAt(receivedAt + retrySeconds * 1000);
          rateLimitAttempts.current += 1;
          // Resume after the provider's wait; stop after three consecutive
          // quota responses without progress so a persistent limit stays quiet.
          setAutoResume(rateLimitAttempts.current <= 3);
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "No pudimos obtener el análisis del coach.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void analyzeAll();
    return () => controller.abort();
  }, [matchId, filter, retry, enabled]);
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) {
        clearInterval(timer);
        if (autoResume) setRetry((value) => value + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt, autoResume]);
  return {
    insights,
    loading,
    error,
    retrySeconds,
    autoResume,
    retryAnalysis: () => {
      rateLimitAttempts.current = 0;
      setRetry((value) => value + 1);
    },
  };
}
