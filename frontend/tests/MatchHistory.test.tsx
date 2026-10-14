import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatchHistory } from "../app/components/MatchHistory";
import { AiChatProvider } from "../app/components/AiChatContext";

function renderWithProvider() {
  return render(
    <AiChatProvider>
      <MatchHistory />
    </AiChatProvider>,
  );
}

describe("MatchHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra las partidas devueltas por el backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              matches: [
                {
                  id: "m1",
                  champion: "Ahri",
                  win: true,
                  kills: 8,
                  deaths: 2,
                  assists: 11,
                  match: { id: "match-1", gameDurationSeconds: 1440, queueId: 420 },
                  metrics: { csPerMin: 7.2, kda: 9.5 },
                },
              ],
              total: 1,
              page: 1,
              pageSize: 10,
              totalPages: 1,
            }),
        }),
      ) as unknown as typeof fetch,
    );

    renderWithProvider();

    await waitFor(() => expect(screen.getByText("Ahri")).toBeInTheDocument());
    expect(screen.getByText("8/2/11")).toBeInTheDocument();
    expect(screen.getByText("Victoria")).toBeInTheDocument();

    // El link tiene que apuntar al id de la PARTIDA (match.id), no al id de
    // la fila de participante (m.id) — son valores distintos a propósito en
    // este mock para atrapar justamente esa confusión.
    const link = screen.getByRole("link", { name: /ahri/i });
    expect(link).toHaveAttribute("href", "/dashboard/partida/match-1");
  });

  it("muestra un mensaje cuando no hay partidas con los filtros aplicados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ matches: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }),
        }),
      ) as unknown as typeof fetch,
    );

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByText(/no encontramos partidas/i)).toBeInTheDocument()
    );
  });

  it("manda el filtro de resultado elegido en la URL de la siguiente consulta", async () => {
    const fetchMock = vi.fn((_url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ matches: [], total: 0, page: 1, pageSize: 10, totalPages: 1 }),
      })
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    renderWithProvider();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const resultSelect = screen.getByDisplayValue("Todos los resultados");
    fireEvent.change(resultSelect, { target: { value: "win" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const lastCall = fetchMock.mock.calls.at(-1)?.[0];
    expect(lastCall).toContain("result=win");
  });
});
