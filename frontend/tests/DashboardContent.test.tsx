import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardContent } from "../app/components/DashboardContent";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("DashboardContent", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.clearAllMocks();
  });

  it("muestra el email del usuario logueado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: "1", email: "a@b.com", emailVerified: true }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<DashboardContent />);
    await waitFor(() =>
      expect(screen.getByText(/hola, a@b.com/i)).toBeInTheDocument(),
    );
  });

  it("redirige a /login si no hay sesión activa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false })) as unknown as typeof fetch,
    );

    render(<DashboardContent />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });

  it("redirige a /login si la red falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network error"))) as unknown as typeof fetch,
    );

    render(<DashboardContent />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });
});
