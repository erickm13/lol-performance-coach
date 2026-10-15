import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SummonerSpellIcon } from "../app/components/SummonerSpellIcon";
import { loadSummonerSpellCatalog } from "../app/lib/dataDragon";

describe("tooltips de hechizos de invocador", () => {
  it("relaciona los IDs de Flash e Ignite con el catálogo y muestra sus efectos y enfriamientos", async () => {
    const data = {
      SummonerFlash: { key: "4", name: "Destello", description: "Teletransporta una corta distancia.", cooldownBurn: "300", image: { full: "SummonerFlash.png" } },
      SummonerDot: { key: "14", name: "Ignición", description: "Inflige <attention>daño verdadero</attention> al objetivo.", cooldownBurn: "180", image: { full: "SummonerDot.png" } },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) });
    vi.stubGlobal("fetch", fetchMock);
    const version = "16.20.2";
    const catalog = await loadSummonerSpellCatalog(version);
    await loadSummonerSpellCatalog(version);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/data/es_MX/summoner.json"));
    render(<>
      <SummonerSpellIcon spellId={4} version={version} spell={catalog[4]} loading={false} />
      <SummonerSpellIcon spellId={14} version={version} spell={catalog[14]} loading={false} />
    </>);
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Destello" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Teletransporta una corta distancia.");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Enfriamiento base: 300 s");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.focus(screen.getByRole("button", { name: "Ignición" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Inflige daño verdadero al objetivo.");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Enfriamiento base: 180 s");
  });

  it("conserva el ícono y nombre conocidos si falla el catálogo y permite reintentar la descarga", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadSummonerSpellCatalog("16.20.3")).rejects.toThrow();
    await expect(loadSummonerSpellCatalog("16.20.3")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    render(<SummonerSpellIcon spellId={4} version="16.20.3" loading={false} />);
    const trigger = screen.getByRole("button", { name: "Flash" });
    expect(trigger.querySelector("img")).toHaveAttribute("src", expect.stringContaining("SummonerFlash.png"));
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("no está disponible");
  });
});
