import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardTeasers } from "../app/components/DashboardTeasers";

describe("DashboardTeasers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra la debilidad más urgente y el estado del plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (typeof url === "string" && url.includes("/riot/weaknesses")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                weaknesses: [
                  {
                    id: "1",
                    category: "farming",
                    description: "Tu CS/min promedio es 3.5.",
                    severity: "high",
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ plan: null, items: [] }),
        });
      }) as unknown as typeof fetch,
    );

    render(<DashboardTeasers />);
    await waitFor(() =>
      expect(screen.getByText(/debilidad más urgente/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/todavía no generaste un plan/i)).toBeInTheDocument();
  });

  it("no renderiza nada sin debilidades detectadas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ weaknesses: [] }),
        }),
      ) as unknown as typeof fetch,
    );

    const { container } = render(<DashboardTeasers />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
