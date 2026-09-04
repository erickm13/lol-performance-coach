import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthStatus } from "../app/components/HealthStatus";

describe("HealthStatus", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ status: "ok", db: "connected" }),
        }),
      ) as unknown as typeof fetch,
    );
  });

  it("muestra el estado del backend una vez que el fetch resuelve", async () => {
    render(<HealthStatus />);

    expect(
      screen.getByText(/cargando estado del sistema/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/estado del backend/i)).toBeInTheDocument();
    });
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
  });
});
