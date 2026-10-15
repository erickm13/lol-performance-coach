import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardContent } from "../app/components/DashboardContent";

const pushMock = vi.fn();
// Return a stable object reference (like Next.js's real useRouter() does)
// instead of a fresh literal per call. DashboardContent's mount effect
// depends on [router]; a new reference on every render would retrigger
// the effect indefinitely once the component stays mounted long enough
// for a second async assertion.
const routerMock = { push: pushMock };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

describe("DashboardContent", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.clearAllMocks();
  });

  it("una vez logueado, renderiza la tarjeta de cuenta de Riot", async () => {
    // El dashboard monta varios componentes que piden distintos endpoints;
    // devolvemos formas válidas por URL para que ninguno reviente al leerlas.
    const json = (value: unknown) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (typeof url === "string") {
          if (url.endsWith("versions.json")) return json(["16.20.1"]);
          if (url.includes("/riot/account")) {
            return json({
              account: null,
              matches: [],
              championStats: [],
              recentTeammates: [],
              lastSyncedAt: null,
            });
          }
          if (url.includes("/riot/weaknesses")) {
            return json({ linked: false, weaknesses: [] });
          }
          if (url.includes("/riot/training-plan")) {
            return json({ linked: false, items: [] });
          }
        }
        return json({ id: "1", email: "a@b.com", emailVerified: true });
      }) as unknown as typeof fetch,
    );

    render(<DashboardContent />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /vincular tu cuenta de riot/i }),
      ).toBeInTheDocument(),
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
