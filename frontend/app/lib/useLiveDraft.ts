"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "./useResource";
import { EMPTY_LIVE_DRAFT, type LiveDraftStatus } from "./liveDraft";
export function useLiveDraft(enabled: boolean) {
  const [state, setState] = useState<LiveDraftStatus>(EMPTY_LIVE_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let failed = false;
      try {
        const data = await apiRequest<LiveDraftStatus>(
          "/preparation/live/status",
          { signal: controller.signal, cache: "no-store" },
        );
        if (!controller.signal.aborted) {
          setState(data);
          setError(null);
        }
      } catch (err) {
        failed = true;
        if (!controller.signal.aborted) {
          setState((current) => ({ ...current, connected: false }));
          setError(
            err instanceof Error
              ? err.message
              : "No pudimos leer la conexión con tu cliente.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          timer = setTimeout(poll, failed || document.hidden ? 8000 : 2000);
        }
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, revision]);
  return { state, error, reload: () => setRevision((old) => old + 1) };
}
