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

  it("muestra un ítem como completado si el backend ya tiene progreso guardado", async () => {
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
                  completed: true,
                },
              ],
            }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<TrainingPlanView />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /completado/i })).toBeDisabled()
    );
  });

  it("genera un plan cuando se hace click en el botón generar", async () => {
    const fetchMock = vi.fn((url: string, options?: Record<string, unknown>) => {
      const isPost = options?.method === "POST";

      if (!isPost) {
        // GET /riot/training-plan on initial load
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ plan: null, items: [] }),
        });
      }

      // POST /riot/training-plan to generate
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { id: "p2", generatedBy: "rules" },
            items: [
              {
                id: "i2",
                type: "drill",
                title: "Ejercicio: CS",
                description: "desc",
                llmExplanation: "Explicación del ejercicio.",
              },
            ],
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<TrainingPlanView />);

    // Wait for the generate button to appear
    const generateButton = await screen.findByRole("button", { name: /generar plan de esta semana/i });

    // Click the generate button
    fireEvent.click(generateButton);

    // Verify the generated items appear
    await waitFor(() =>
      expect(screen.getByText(/explicación del ejercicio/i)).toBeInTheDocument()
    );
  });
});
