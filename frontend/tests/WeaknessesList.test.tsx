import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WeaknessesList } from "../app/components/WeaknessesList";

// WeaknessesList consulta /riot/weaknesses y /riot/training-plan vía useResource.
function mockFetch(weaknesses: unknown) {
  const json = (value: unknown) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/riot/weaknesses")) {
        return json(weaknesses);
      }
      if (typeof url === "string" && url.includes("/riot/training-plan")) {
        return json({ plan: null, items: [] });
      }
      return json({});
    }) as unknown as typeof fetch,
  );
}

describe("WeaknessesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra las debilidades devueltas por el backend", async () => {
    mockFetch({
      linked: true,
      sample: { count: 10, required: 10 },
      weaknesses: [
        {
          id: "1",
          category: "farming",
          severity: "high",
          description: "Tu CS/min promedio es 3.5.",
        },
      ],
    });

    render(<WeaknessesList />);
    await waitFor(() =>
      expect(screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "Tu CS/min promedio es 3.5.")).toBeInTheDocument()
    );
    // La severidad "high" se muestra como prioridad "Alta".
    expect(within(screen.getByRole("article")).getByText(/prioridad alta/i)).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay debilidades detectadas", async () => {
    mockFetch({
      linked: true,
      sample: { count: 10, required: 10 },
      weaknesses: [],
    });

    render(<WeaknessesList />);
    await waitFor(() =>
      expect(
        screen.getByText(/sin debilidades detectadas/i),
      ).toBeInTheDocument()
    );
  });
});
