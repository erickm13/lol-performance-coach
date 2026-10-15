import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChampionIcon } from "../app/components/ChampionIcon";

const champion = {
  id: "Gwen", name: "Gwen", title: "Campeona de prueba", tags: ["Fighter", "Mage"],
  passive: { name: "Pasiva de prueba", description: "Efecto <attention>pasivo</attention>.", image: { full: "Gwen_Passive.png" } },
  spells: ["Q", "W", "E", "R"].map((key) => ({ name: `Habilidad ${key}`, description: `Descripción de ${key}.`, image: { full: `Gwen${key}.png` } })),
};
const response = (title = champion.title) => ({ ok: true, json: async () => ({ data: { Gwen: { ...champion, title } } }) });

describe("tooltips de campeones", () => {
  it("carga al abrir y comparte los datos entre el retrato de una partida y Champion Stats", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
    render(<>
      <ChampionIcon champion="Gwen" version="16.20.11" className="mini-champ" />
      <ChampionIcon champion="Gwen" version="16.20.11" className="champ-icon-sm" />
    </>);
    expect(fetchMock).not.toHaveBeenCalled();
    const icons = screen.getAllByRole("button", { name: "Gwen" });
    fireEvent.pointerEnter(icons[0]);
    await screen.findByText("Campeona de prueba");
    const popup = screen.getByRole("tooltip");
    expect(popup).toHaveTextContent("Luchador · Mago");
    expect(popup).toHaveTextContent("Pasiva de prueba");
    expect(popup).toHaveTextContent("Efecto pasivo.");
    for (const key of ["Q", "W", "E", "R"]) expect(popup).toHaveTextContent(`Descripción de ${key}.`);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.focus(icons[1]);
    await screen.findByText("Campeona de prueba");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/data/es_MX/champion/Gwen.json"));
  });

  it("permite reintentar después de un fallo y conserva el retrato", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetchMock);
    render(<ChampionIcon champion="Gwen" version="16.20.12" className="mini-champ" />);
    const icon = screen.getByRole("button", { name: "Gwen" });
    fireEvent.click(icon);
    await screen.findByText(/No se pudo cargar la información/);
    expect(icon.querySelector("img")).toHaveAttribute("src", expect.stringContaining("/img/champion/Gwen.png"));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(icon);
    await screen.findByText("Campeona de prueba");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignora respuestas antiguas cuando cambia el parche durante la descarga", async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    const fetchMock = vi.fn()
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(response("Parche nuevo"));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<ChampionIcon champion="Gwen" version="16.20.13" className="mini-champ" />);
    fireEvent.click(screen.getByRole("button", { name: "Gwen" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender(<ChampionIcon champion="Gwen" version="16.20.14" className="mini-champ" />);
    await screen.findByText("Parche nuevo");
    await act(async () => { resolveOld(response("Parche viejo")); });
    expect(screen.queryByText("Parche viejo")).not.toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Parche nuevo");
  });
});
