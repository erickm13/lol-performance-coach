import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardTeasers } from "../app/components/DashboardTeasers";

function mockFetch(weaknesses: unknown, plan: unknown = { plan: null, items: [] }) {
  const json = (value: unknown) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/riot/weaknesses")) {
        return json(weaknesses);
      }
      if (typeof url === "string" && url.includes("/riot/training-plan")) {
        return json(plan);
      }
      return json({});
    }) as unknown as typeof fetch,
  );
}

describe("DashboardTeasers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el foco de mejora y la próxima práctica", async () => {
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

    render(<DashboardTeasers />);
    await waitFor(() =>
      expect(screen.getByText(/tu foco de mejora/i)).toBeInTheDocument()
    );
    // La categoría "farming" se muestra como "Farmeo".
    expect(screen.getByText(/farmeo/i)).toBeInTheDocument();
    expect(screen.getByText(/tu próxima práctica/i)).toBeInTheDocument();
  });

  it("no renderiza nada si la cuenta no está vinculada", async () => {
    mockFetch({ linked: false, weaknesses: [] });

    const { container } = render(<DashboardTeasers />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
