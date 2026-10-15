import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RiotAccountCard } from "../app/components/RiotAccountCard";

vi.mock("../app/components/AiChatContext", () => ({ useAiChat: () => ({ openChat: vi.fn() }) }));
vi.mock("../app/lib/dataDragon", async (importOriginal) => ({
  ...await importOriginal<typeof import("../app/lib/dataDragon")>(),
  loadItemCatalog: vi.fn().mockResolvedValue({}),
  loadSummonerSpellCatalog: vi.fn().mockResolvedValue({}),
}));

const oldTimestamp = "2026-10-14T20:00:00.000Z";
const newTimestamp = "2026-10-15T20:00:00.000Z";
const stored = {
  account: { summonerName: "Tester", tagLine: "LAN", region: "LAN", profileIconId: 1, summonerLevel: 129, soloTier: null },
  matches: [{
    champion: "Gwen", win: true, kills: 5, deaths: 2, assists: 8,
    rawStats: { item0: 1001, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340, summoner1Id: 4, summoner2Id: 12 },
    metrics: { csPerMin: 6, kda: 6.5 },
  }],
  lastSyncedAt: oldTimestamp,
};

function setupFetch(syncStatus: number, syncBody: object, nextTimestamp = newTimestamp) {
  let synced = false;
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("versions.json")) return { ok: true, json: async () => ["16.20.1"] };
    if (url.endsWith("/riot/sync")) {
      synced = true;
      return { ok: syncStatus === 200, json: async () => syncBody };
    }
    return { ok: true, json: async () => ({ ...stored, lastSyncedAt: synced ? nextTimestamp : oldTimestamp }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("sincronización y ayuda del dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it("muestra la fecha guardada y la reemplaza después de una sincronización completa", async () => {
    setupFetch(200, { partial: false });
    const { container } = render(<RiotAccountCard emailVerified />);
    await screen.findByRole("button", { name: "Actualizar partidas" });
    expect(container.querySelector("time")).toHaveAttribute("datetime", oldTimestamp);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar partidas" }));
    await waitFor(() => expect(container.querySelector("time")).toHaveAttribute("datetime", newTimestamp));
  });

  it("conserva la fecha anterior y muestra el error cuando falla Riot", async () => {
    setupFetch(502, { error: "La clave de Riot expiró" });
    const { container } = render(<RiotAccountCard emailVerified />);
    fireEvent.click(await screen.findByRole("button", { name: "Actualizar partidas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La clave de Riot expiró");
    expect(container.querySelector("time")).toHaveAttribute("datetime", oldTimestamp);
  });

  it("avisa de una actualización parcial sin presentarla como una sincronización completa", async () => {
    setupFetch(200, { partial: true }, oldTimestamp);
    const { container } = render(<RiotAccountCard emailVerified />);
    fireEvent.click(await screen.findByRole("button", { name: "Actualizar partidas" }));
    expect(await screen.findByText(/Actualización parcial:/)).toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute("datetime", oldTimestamp);
  });

  it("explica la fórmula y la muestra de KDA al pasar el mouse", async () => {
    setupFetch(200, {});
    render(<RiotAccountCard emailVerified />);
    const help = await screen.findByRole("button", { name: "Qué significa KDA promedio" });
    fireEvent.pointerEnter(help);
    expect(screen.getByRole("tooltip")).toHaveTextContent("(asesinatos + asistencias)");
    expect(screen.getByRole("tooltip")).toHaveTextContent("1 partidas con métricas");
  });
});
