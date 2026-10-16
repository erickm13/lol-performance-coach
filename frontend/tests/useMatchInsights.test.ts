import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMatchInsights } from "../app/lib/useMatchInsights";

const batch = (evaluated: number, complete = false) => ({
  version: 5,
  generatedAt: "2026-10-15T23:00:00Z",
  coachingRevision: "saved-preferences",
  suggestions: [],
  goodPlays: [],
  observations: Array.from({ length: evaluated }, (_, eventIndex) => ({ eventIndex, title: "Momento evaluado", explanation: "Contexto del evento" })),
  progress: { evaluated, total: 4, complete },
});
const response = (body: unknown, status = 200) => Promise.resolve({ ok: status === 200, status, json: async () => body } as Response);

describe("análisis del mapa con caché de preferencias v5", () => {
  it("muestra los lotes del backend v5 y continúa hasta terminar", async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() => response(batch(2))).mockImplementationOnce(() => response(batch(4, true)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useMatchInsights("match-id", "all", true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.insights?.progress).toEqual({ evaluated: 4, total: 4, complete: true });
    expect(result.current.insights?.observations).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("conserva el progreso v5 ante cuota y permite reanudarlo", async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() => response({ code: "rate_limit", error: "Espera antes de continuar", retryAfterSeconds: 60, partial: batch(2) }, 429)).mockImplementationOnce(() => response(batch(4, true)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useMatchInsights("match-id", "all", true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.insights?.progress.evaluated).toBe(2);
    expect(result.current.error).toBe("Espera antes de continuar");
    expect(result.current.autoResume).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => result.current.retryAnalysis());
    await waitFor(() => expect(result.current.insights?.progress.complete).toBe(true));
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
