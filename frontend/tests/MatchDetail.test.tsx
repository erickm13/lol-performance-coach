import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatchDetail } from "../app/components/MatchDetail";
import { AiChatProvider } from "../app/components/AiChatContext";

function renderWithProvider(matchId: string) {
  return render(
    <AiChatProvider>
      <MatchDetail matchId={matchId} />
    </AiChatProvider>,
  );
}

describe("MatchDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el resultado, el stat grid y ambos equipos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              match: { gameDurationSeconds: 1680, gameCreation: "2026-09-01T00:00:00Z", queueId: 420 },
              own: {
                id: "own-1",
                champion: "Zed",
                kills: 12,
                deaths: 4,
                assists: 6,
                win: true,
                teamId: 100,
                metrics: {
                  csPerMin: 7.9,
                  kda: 4.5,
                  visionScorePerMin: 0.71,
                  goldPerMin: 412,
                  killParticipation: 0.58,
                },
              },
              teams: {
                blue: [
                  { id: "own-1", champion: "Zed", kills: 12, deaths: 4, assists: 6, win: true, teamId: 100 },
                  { id: "p2", champion: "LeeSin", kills: 8, deaths: 5, assists: 9, win: true, teamId: 100 },
                ],
                red: [
                  { id: "p3", champion: "Ahri", kills: 6, deaths: 4, assists: 9, win: false, teamId: 200 },
                ],
              },
            }),
        }),
      ) as unknown as typeof fetch,
    );

    renderWithProvider("match-1");

    await waitFor(() => expect(screen.getByText("Victoria")).toBeInTheDocument());
    expect(screen.getByText("12 / 4 / 6")).toBeInTheDocument();
    expect(screen.getByText("7.9")).toBeInTheDocument();
    expect(screen.getByText("Zed (vos)")).toBeInTheDocument();
    expect(screen.getByText("LeeSin")).toBeInTheDocument();
    expect(screen.getByText("Ahri")).toBeInTheDocument();
  });

  it("muestra un mensaje si la partida no existe o no pertenece a la cuenta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Partida no encontrada" }),
        }),
      ) as unknown as typeof fetch,
    );

    renderWithProvider("match-ajena");

    await waitFor(() =>
      expect(screen.getByText(/no encontramos esa partida/i)).toBeInTheDocument()
    );
  });
});
