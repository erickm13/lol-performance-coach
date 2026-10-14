import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WeaknessesList } from "../app/components/WeaknessesList";

describe("WeaknessesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra las debilidades devueltas por el backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
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
        }),
      ) as unknown as typeof fetch,
    );

    render(<WeaknessesList />);
    await waitFor(() =>
      expect(screen.getByText(/tu cs\/min promedio es 3.5/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/alta/i)).toBeInTheDocument();
  });

  it("muestra un mensaje cuando todavía no hay debilidades detectadas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ weaknesses: [] }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<WeaknessesList />);
    await waitFor(() =>
      expect(
        screen.getByText(/todavía no detectamos patrones/i),
      ).toBeInTheDocument()
    );
  });
});
