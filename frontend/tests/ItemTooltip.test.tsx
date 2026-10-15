import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemIcon } from "../app/components/ItemIcon";
import { dataDragonDescriptionText } from "../app/lib/dataDragon";

describe("tooltips de objetos", () => {
  it("muestra los datos en un portal, accesible por teclado y cerrable con Escape", () => {
    const { container } = render(
      <div style={{ overflow: "hidden" }}>
        <ItemIcon itemId={1001} version="16.20.1" loading={false} item={{
          name: "Botas",
          description: "<mainText><stats>25 de velocidad de movimiento</stats><br>Movete más rápido &amp; esquivá.</mainText>",
          gold: { total: 300, sell: 210, purchasable: true },
        }} />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Botas" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.focus(trigger);
    const popup = screen.getByRole("tooltip");
    expect(popup).toHaveTextContent("25 de velocidad de movimiento");
    expect(popup).toHaveTextContent("Movete más rápido & esquivá.");
    expect(popup).toHaveTextContent("Costo: 300 de oro");
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    expect(trigger).toHaveAttribute("aria-describedby", popup.id);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("permite abrirlo al tocar el objeto y muestra una alternativa si falta el catálogo", () => {
    render(<ItemIcon itemId={3340} version="16.20.1" loading={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Objeto 3340" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("no está disponible");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("preserva saltos de línea y entidades, eliminando el HTML y los scripts", () => {
    expect(dataDragonDescriptionText('<stats>+25 vida</stats><br><passive>Escudo &amp; defensa</passive><script>alert("x")</script>'))
      .toBe("+25 vida\n\nEscudo & defensa");
  });
});
