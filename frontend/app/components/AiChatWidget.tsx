"use client";

import { useState } from "react";
import { useAiChat } from "./AiChatContext";

export function AiChatFab() {
  const { openChat } = useAiChat();
  return (
    <button
      onClick={() => openChat("general")}
      aria-label="Abrir chat con la IA"
      className="fixed bottom-7 right-7 z-50 h-14 w-14 rounded-full bg-teal text-[#06110f] text-2xl shadow-lg shadow-black/50 flex items-center justify-center hover:bg-teal-dim transition-colors"
    >
      💬
    </button>
  );
}

export function AiChatWidget() {
  const { isOpen, messages, loading, closeChat, sendMessage } = useAiChat();
  const [draft, setDraft] = useState("");

  if (!isOpen) return null;

  function handleSend() {
    sendMessage(draft);
    setDraft("");
  }

  return (
    <div className="fixed bottom-24 right-7 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-9rem)] rune-panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-panel-line">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-teal text-[#06110f] flex items-center justify-center text-sm">
            ✨
          </div>
          <div>
            <p className="font-display font-semibold text-sm">
              Asistente de IA
            </p>
            <p className="text-teal text-xs flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              En línea
            </p>
          </div>
        </div>
        <button
          onClick={closeChat}
          aria-label="Cerrar chat"
          className="text-mist hover:text-parchment text-lg leading-none px-1"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] text-sm leading-relaxed px-3.5 py-2.5 ${
              m.role === "bot"
                ? "self-start bg-ink border border-panel-line text-parchment"
                : "self-end bg-teal text-[#06110f]"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="self-start bg-ink border border-panel-line text-mist text-sm px-3.5 py-2.5">
            Escribiendo...
          </div>
        )}
      </div>

      <div className="flex gap-2 p-3 border-t border-panel-line">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          type="text"
          placeholder="Escribí tu pregunta..."
          className="rune-field flex-1 text-sm"
        />
        <button
          onClick={handleSend}
          className="bg-teal text-[#06110f] font-semibold text-sm px-4 hover:bg-teal-dim transition-colors"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
