import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardContent } from "../app/components/DashboardContent";

const pushMock = vi.fn();
// Return a stable object reference (like Next.js's real useRouter() does)
// instead of a fresh literal per call. DashboardContent's mount effect
// depends on [router]; a new reference on every render would retrigger
// the effect indefinitely once the component stays mounted long enough
// for a second async assertion (as the logout test below does).
const routerMock = { push: pushMock };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
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

  it("redirige a /login aunque el fetch de logout falle", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/auth/logout")) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ id: "1", email: "a@b.com", emailVerified: true }),
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    // handleLogout intentionally has no catch (only try/finally, per design:
    // the redirect must happen regardless of whether the server-side logout
    // succeeds). That means the promise handleLogout returns to React's
    // onClick (which React never awaits) rejects. Swallow that expected
    // rejection here so it doesn't crash the test worker; it is not a
    // rejection this test is trying to observe.
    const ignoreExpectedRejection = () => {};
    process.on("unhandledRejection", ignoreExpectedRejection);

    try {
      render(<DashboardContent />);
      await waitFor(() =>
        expect(screen.getByText(/hola, a@b.com/i)).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
    } finally {
      process.off("unhandledRejection", ignoreExpectedRejection);
    }
  });
});
