import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LogoutButton } from "../app/components/LogoutButton";

const pushMock = vi.fn();
const routerMock = { push: pushMock };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

describe("LogoutButton", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.clearAllMocks();
  });

  it("redirige a /login cuando el logout del servidor tiene éxito", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true })) as unknown as typeof fetch,
    );

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });

  it("redirige a /login aunque el fetch de logout falle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network error"))) as unknown as typeof fetch,
    );

    // handleLogout intentionally has no catch (only try/finally, per design:
    // the redirect must happen regardless of whether the server-side logout
    // succeeds). That means the promise handleLogout returns to React's
    // onClick (which React never awaits) rejects. Swallow that expected
    // rejection here so it doesn't crash the test worker; it is not a
    // rejection this test is trying to observe.
    const ignoreExpectedRejection = () => {};
    process.on("unhandledRejection", ignoreExpectedRejection);

    try {
      render(<LogoutButton />);
      fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
    } finally {
      process.off("unhandledRejection", ignoreExpectedRejection);
    }
  });
});
