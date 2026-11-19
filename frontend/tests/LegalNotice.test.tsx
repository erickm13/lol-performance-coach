import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../app/components/AppShell";

const routerMock = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/dashboard",
}));

function stubSession(legalNoticeAcceptedAt: string | null) {
  const fetchMock = vi.fn((url: string) => {
    const body = String(url).endsWith("/auth/legal-notice")
      ? { legalNoticeAcceptedAt: "2026-11-19T23:30:00.000Z" }
      : String(url).endsWith("/auth/me")
      ? { id: "1", email: "a@b.com", emailVerified: true, legalNoticeAcceptedAt }
      : {};
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

describe("aviso legal de Riot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aparece la primera vez y se registra al aceptarlo", async () => {
    const fetchMock = stubSession(null);
    render(<AppShell><p>contenido</p></AppShell>);
    const dialog = await screen.findByRole("dialog", { name: "Aviso legal" });
    expect(dialog).toHaveTextContent("no está respaldado por Riot Games");

    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Aviso legal" })).not.toBeInTheDocument()
    );
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/auth/legal-notice")),
    ).toBe(true);
  });

  it("no vuelve a aparecer si la cuenta ya lo aceptó", async () => {
    stubSession("2026-11-19T23:30:00.000Z");
    render(<AppShell><p>contenido</p></AppShell>);
    await screen.findByText("contenido");
    expect(screen.queryByRole("dialog", { name: "Aviso legal" })).not.toBeInTheDocument();
  });
});
