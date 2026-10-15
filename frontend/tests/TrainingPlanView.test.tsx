import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
// TrainingPlanView es un re-export de TrainingHub (Plan y Entrenamiento unificados).
import { TrainingPlanView } from "../app/components/TrainingPlanView";

const ENOUGH_SAMPLE = {
  linked: true,
  sample: { count: 10, required: 10 },
  weaknesses: [
    { id: "w1", category: "farming", severity: "high", description: "CS bajo." },
  ],
};

const PLAN_WITH_DRILL = {
  plan: {
    id: "p1",
    weekStart: "2026-10-13",
    weekEnd: "2026-10-19",
    generatedBy: "rules",
  },
  items: [
    {
      id: "i1",
      type: "drill",
      title: "Ejercicio: farming",
      description: "Practica últimos golpes bajo torre.",
      llmExplanation: null,
      completed: false,
    },
  ],
};

function mockFetch(plan: unknown, weaknesses: unknown = ENOUGH_SAMPLE) {
  const json = (value: unknown) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (typeof url === "string") {
        if (url.endsWith("versions.json")) return json(["16.20.1"]);
        if (url.includes("/progress")) return json({});
        if (url.includes("/riot/weaknesses")) return json(weaknesses);
        if (url.includes("/riot/training-plan")) return json(plan);
      }
      return json({});
    }) as unknown as typeof fetch,
  );
}

describe("TrainingHub (Entrenamiento)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el botón para generar el plan cuando no hay uno activo", async () => {
    mockFetch({ plan: null, items: [] });

    render(<TrainingPlanView />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /generar mi plan semanal/i }),
      ).toBeInTheDocument()
    );
  });

  it("muestra el plan semanal con sus ejercicios", async () => {
    mockFetch(PLAN_WITH_DRILL);

    render(<TrainingPlanView />);
    await waitFor(() =>
      expect(screen.getByText(/tu plan semanal/i)).toBeInTheDocument()
    );
    expect(
      screen.getAllByRole("button", { name: /marcar como completado/i }).length,
    ).toBeGreaterThan(0);
  });

  it("marca un ejercicio como completado", async () => {
    mockFetch(PLAN_WITH_DRILL);

    render(<TrainingPlanView />);
    const buttons = await screen.findAllByRole("button", {
      name: /marcar como completado/i,
    });
    fireEvent.click(buttons[0]);

    await waitFor(() =>
      expect(screen.getAllByText(/✓ completado/i).length).toBeGreaterThan(0)
    );
  });
});
