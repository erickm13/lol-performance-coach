"use client";

import { useEffect, useRef, useState } from "react";
import { useAiChat } from "./AiChatContext";
import { CoachIcon } from "./CoachIcon";

function ChatGlyph({ kind }: { kind: "coach" | "close" | "send" | "reset" | "arrow" }) {
  if (kind === "coach") return <CoachIcon />;
  const paths = {
    close: "m6 6 12 12M6 18 18 6",
    send: "m4 4 17 8-17 8 4-8-4-8Zm4 8h13",
    reset: "M4 10a8 8 0 1 1 1 8M4 4v6h6",
    arrow: "M5 12h14m-5-5 5 5-5 5",
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[kind]} />
    </svg>
  );
}

export function AiChatFab() {
  const { coachName, isOpen, loading, openChat, closeChat } = useAiChat();
  return (
    <button
      id="ai-chat-toggle"
      type="button"
      onClick={() => isOpen ? closeChat() : openChat()}
      aria-label={isOpen ? "Minimizar chat" : "Abrir chat con tu coach"}
      aria-expanded={isOpen}
      aria-controls="ai-chat-panel"
      className={`ai-chat-launcher ${isOpen ? "is-open" : ""}`}
    >
      <span className="ai-chat-launcher-mark"><ChatGlyph kind={isOpen ? "close" : "coach"} /></span>
      <span className="ai-chat-launcher-copy">
        <span>{isOpen ? "Minimizar chat" : coachName}</span>
        <small>{loading ? "Preparando tu respuesta" : "Tu próxima jugada"}</small>
      </span>
      {!isOpen && <span className="ai-chat-launcher-arrow"><ChatGlyph kind="arrow" /></span>}
    </button>
  );
}

export function AiChatWidget() {
  const { coachName, isOpen, messages, loading, error, activeContext, openChat, closeChat, sendMessage, retryLastRequest } = useAiChat();
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);

  useEffect(() => {
    if (!isOpen) return;
    followLatest.current = true;
    const timer = setTimeout(() => composerRef.current?.focus({ preventScroll: true }), 0);
    return () => {
      clearTimeout(timer);
      document.getElementById("ai-chat-toggle")?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  useEffect(() => {
    setDraft("");
    followLatest.current = true;
  }, [activeContext]);

  useEffect(() => {
    if (isOpen && followLatest.current && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [isOpen, messages, loading, error]);

  useEffect(() => {
    if (!composerRef.current) return;
    composerRef.current.style.height = "auto";
    composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 120)}px`;
  }, [draft, isOpen]);

  if (!isOpen) return null;

  const match = activeContext.match;
  const matchContext = activeContext.kind === "match";
  const suggestions = matchContext
    ? ["¿Qué puedo mejorar en esta partida?", "¿Cómo mejoro mi farmeo?", "¿Qué debería practicar después?"]
    : ["¿Cómo puedo mejorar mi farmeo?", "¿Cómo puedo morir menos?", "¿Cómo controlo mejor la visión?"];
  const canSend = !!draft.trim() && !loading;

  function handleSend(text = draft) {
    if (!text.trim() || loading) return;
    followLatest.current = true;
    if (sendMessage(text)) setDraft("");
  }

  return (
    <section
      id="ai-chat-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="ai-chat-title"
      className="ai-chat-panel"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeChat();
        }
      }}
    >
      <header className="ai-chat-header">
        <span className="ai-chat-avatar"><ChatGlyph kind="coach" /></span>
        <div className="ai-chat-header-copy">
          <p className="ai-chat-eyebrow">TU ESPACIO PARA MEJORAR</p>
          <h2 id="ai-chat-title">{coachName}</h2>
          <p className={`ai-chat-status ${loading ? "is-thinking" : ""}`}>
            <span aria-hidden="true" />
            {loading ? "Pensando la próxima jugada..." : error ? "No se pudo obtener una respuesta" : "Análisis y consejos para tu juego"}
          </p>
        </div>
        <div className="ai-chat-header-actions">
          <button type="button" onClick={() => { setDraft(""); followLatest.current = true; openChat("general"); }} aria-label="Nueva conversación" title="Nueva conversación" className="ai-chat-icon-button"><ChatGlyph kind="reset" /></button>
          <button type="button" onClick={closeChat} aria-label="Cerrar chat" title="Minimizar chat" className="ai-chat-icon-button"><ChatGlyph kind="close" /></button>
        </div>
      </header>

      {matchContext && <div className="ai-chat-context is-match">
        <span className="ai-chat-context-symbol" aria-hidden="true">◇</span>
        <span>Analizando {match?.champion ?? "tu partida"}</span>
        {typeof match?.win === "boolean" && (
          <span className={`ai-chat-context-result ${match.win ? "win" : "loss"}`}>{match.win ? "Victoria" : "Derrota"}</span>
        )}
      </div>}

      <div
        ref={messageListRef}
        className="ai-chat-body"
        role="log"
        aria-label="Conversación con tu coach"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={loading}
        onScroll={() => {
          const list = messageListRef.current;
          if (list) followLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 72;
        }}
      >
        {messages.map((message, index) => (
          <div key={index} className={`ai-chat-message ${message.role}`}>
            {message.role === "bot" && <span className="ai-chat-message-avatar"><ChatGlyph kind="coach" /></span>}
            <div className="ai-chat-message-content">
              <span className="ai-chat-message-author">{message.role === "bot" ? coachName : "TÚ"}</span>
              <div className="ai-chat-bubble">{message.text}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-chat-thinking" role="status">
            <span className="ai-chat-message-avatar"><ChatGlyph kind="coach" /></span>
            <span className="ai-chat-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>Preparando tu respuesta</span>
          </div>
        )}

        {error && (
          <div className="ai-chat-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={retryLastRequest}><ChatGlyph kind="reset" />Reintentar</button>
          </div>
        )}

        {!loading && !error && !messages.some((message) => message.role === "user") && (
          <div className="ai-chat-suggestions">
            <p>{matchContext ? "Seguimos con esta partida" : "¿Por dónde empezamos?"}</p>
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => handleSend(suggestion)}>
                <span>{suggestion}</span><ChatGlyph kind="arrow" />
              </button>
            ))}
          </div>
        )}
      </div>

      <form className="ai-chat-footer" onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
        <div className="ai-chat-composer">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            maxLength={2000}
            aria-label="Tu mensaje para el coach"
            placeholder={matchContext ? "Pregunta sobre esta partida..." : "¿En qué quieres mejorar?"}
          />
          <button type="submit" disabled={!canSend} aria-label="Enviar mensaje" className="ai-chat-send"><ChatGlyph kind="send" /></button>
        </div>
        <div className="ai-chat-footer-note">
          <span>Enter para enviar · Shift + Enter para salto</span>
          <span>{draft.length > 1600 ? `${draft.length}/2000` : "A tu ritmo."}</span>
        </div>
      </form>
    </section>
  );
}
