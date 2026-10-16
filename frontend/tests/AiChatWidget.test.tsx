import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiChatProvider, useAiChat } from "../app/components/AiChatContext";
import { AiChatFab, AiChatWidget } from "../app/components/AiChatWidget";

const MATCH_ID = "32f180c1-701c-4000-8000-000000000001";
const completeText = (text: string) => (_: string, node: Element | null) => node?.textContent === text && !Array.from(node.children).some((child) => child.textContent === text);

const greeting = "Hola, contame qué querés mejorar.";
const reply = (text: string) => ({ ok: true, json: async () => ({ messages: [{ role: "bot", text }] }) });

function MatchButton() {
  const { openChat } = useAiChat();
  return <button onClick={() => openChat("match", { id: MATCH_ID, champion: "Gwen", win: true, kills: 5, deaths: 2, assists: 8 })}>Analizar Gwen</button>;
}

function renderChat() {
  return render(<AiChatProvider><AiChatFab /><AiChatWidget /><MatchButton /></AiChatProvider>);
}

async function openGeneralChat() {
  fireEvent.click(screen.getByRole("button", { name: "Abrir chat con tu coach" }));
  await screen.findByText(greeting);
  return screen.getByRole("textbox", { name: "Tu mensaje para el coach" });
}

describe("chat del coach", () => {
  it("conserva mensajes y borrador al minimizar y reabrir", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(greeting)).mockResolvedValueOnce(reply("Trabajemos tu farmeo."));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    const composer = await openGeneralChat();
    const name = screen.getByRole("heading", { level: 2 }).textContent;
    expect(name).toMatch(/^Coach (Gromp|Krug|Lóbrego|Picuchillo|Escurridizo)$/);
    expect(screen.queryByText("Una pregunta. Un paso adelante.")).not.toBeInTheDocument();
    fireEvent.change(composer, { target: { value: "Quiero mejorar el farmeo" } });
    fireEvent.keyDown(composer, { key: "Enter" });
    await screen.findByText(completeText("Trabajemos tu farmeo."));
    fireEvent.change(composer, { target: { value: "Mi siguiente pregunta" } });
    fireEvent.click(screen.getByRole("button", { name: "Minimizar chat" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir chat con tu coach" }));
    expect(screen.getByText(completeText("Trabajemos tu farmeo."))).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(name!);
    expect(screen.getByText("TÚ")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Mi siguiente pregunta");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("permite varias líneas y evita envíos duplicados mientras espera respuesta", async () => {
    let finish!: (response: ReturnType<typeof reply>) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(greeting)).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    const composer = await openGeneralChat();
    fireEvent.change(composer, { target: { value: "Primera línea" } });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(composer, { key: "Enter", isComposing: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(composer, { target: { value: "Primera línea\nSegunda línea" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).message).toBe("Primera línea\nSegunda línea");
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    fireEvent.change(composer, { target: { value: "Seguimiento" } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => finish(reply("Acá va tu respuesta.")));
    expect(composer).toHaveValue("Seguimiento");
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();
  });

  it("reintenta un error sin duplicar la pregunta sugerida", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply(greeting))
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "El servicio está ocupado." }) })
      .mockResolvedValueOnce(reply("Revisá el mapa antes de avanzar."));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    await openGeneralChat();
    const question = "¿Cómo puedo morir menos?";
    fireEvent.click(screen.getByRole("button", { name: question }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El servicio está ocupado.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Revisá el mapa antes de avanzar.");
    expect(screen.getAllByText(question)).toHaveLength(1);
    expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });

  it("mantiene el contexto de la partida y permite empezar una conversación general", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply("Veamos tu partida con Gwen."))
      .mockResolvedValueOnce(reply("Podés practicar el farmeo."))
      .mockResolvedValueOnce(reply(greeting));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Analizar Gwen" }));
    await screen.findByText("Veamos tu partida con Gwen.");
    expect(screen.getByText("Analizando Gwen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "¿Qué debería practicar después?" }));
    await screen.findByText(completeText("Podés practicar el farmeo."));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ context: "match", matchId: MATCH_ID, history: [{ role: "bot", text: "Veamos tu partida con Gwen." }] });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("match");
    fireEvent.click(screen.getByRole("button", { name: "Nueva conversación" }));
    await screen.findByText(greeting);
    expect(screen.queryByText("Analizando Gwen")).not.toBeInTheDocument();
    expect(screen.queryByText(completeText("Podés practicar el farmeo."))).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).context).toBe("general");
  });

  it("descarta una respuesta anterior si se cambia de conversación durante la descarga", async () => {
    let finishOld!: (response: ReturnType<typeof reply>) => void;
    const fetchMock = vi.fn()
      .mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce(reply("Esta es la partida de Gwen."));
    vi.stubGlobal("fetch", fetchMock);
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Abrir chat con tu coach" }));
    fireEvent.click(screen.getByRole("button", { name: "Analizar Gwen" }));
    await screen.findByText("Esta es la partida de Gwen.");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => finishOld(reply("Respuesta de una conversación anterior.")));
    expect(screen.queryByText("Respuesta de una conversación anterior.")).not.toBeInTheDocument();
  });

  it("cierra con Escape y devuelve el foco al botón flotante", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(greeting)));
    renderChat();
    const composer = await openGeneralChat();
    await waitFor(() => expect(composer).toHaveFocus());
    fireEvent.keyDown(composer, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir chat con tu coach" })).toHaveFocus();
  });
});
