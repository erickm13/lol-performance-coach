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

  it("genera y muestra el plan al pulsar el botón", async () => {
    mockFetch({ plan: null, items: [] });
    const originalMock = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((url, init) => {
      if (String(url).endsWith("/riot/training-plan") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => PLAN_WITH_DRILL } as Response);
      }
      return originalMock(url, init);
    });
    render(<TrainingPlanView />);
    fireEvent.click(await screen.findByRole("button", { name: /generar mi plan semanal/i }));
    expect(await screen.findByRole("heading", { name: /tus ejercicios de esta semana/i })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/riot/training-plan"), expect.objectContaining({ method: "POST" }));
  });

  it("restaura el cumplimiento guardado y permite consultar los completados", async () => {
    mockFetch({ ...PLAN_WITH_DRILL, items: PLAN_WITH_DRILL.items.map((item) => ({ ...item, completed: true })) });
    render(<TrainingPlanView />);
    expect(await screen.findByRole("heading", { name: /has completado tus ejercicios/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /marcar como completado/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /todos/i }));
    expect(screen.getAllByRole("button", { name: /completado:/i })).toHaveLength(2);
    screen.getAllByRole("button", { name: /completado:/i }).forEach((button) => expect(button).toBeDisabled());
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/progress"), expect.anything());
  });

  it("muestra el plan semanal con sus ejercicios", async () => {
    mockFetch(PLAN_WITH_DRILL);

    render(<TrainingPlanView />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /tus ejercicios de esta semana/i })).toBeInTheDocument()
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
