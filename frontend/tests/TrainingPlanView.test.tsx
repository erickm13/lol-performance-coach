import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrainingPlanView } from "../app/components/TrainingPlanView";

describe("TrainingPlanView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el botón para generar el plan cuando no hay uno activo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ plan: null, items: [] }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<TrainingPlanView />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /generar plan de esta semana/i }),
      ).toBeInTheDocument()
    );
  });

  it("muestra los ítems del plan activo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              plan: { id: "p1", generatedBy: "rules" },
              items: [
                {
                  id: "i1",
                  type: "focus_area",
                  title: "Trabajar: farming",
                  description: "desc",
                  llmExplanation: "Explicación del ítem.",
                },
              ],
            }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<TrainingPlanView />);
    await waitFor(() =>
      expect(screen.getByText(/explicación del ítem/i)).toBeInTheDocument()
    );
  });

  it("marca un ítem como completado", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/progress")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { id: "p1", generatedBy: "rules" },
            items: [
              {
                id: "i1",
                type: "focus_area",
                title: "Trabajar: farming",
                description: "desc",
                llmExplanation: "Explicación del ítem.",
              },
            ],
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<TrainingPlanView />);
    const button = await screen.findByRole("button", { name: /marcar completado/i });
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /completado/i })).toBeDisabled()
    );
  });
});
