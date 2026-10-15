"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getBackendUrl } from "../lib/api";

type ChatMessage = { role: "bot" | "user"; text: string };
type ChatContextKind = "general" | "match";
const JUNGLE_CAMPS = ["Gromp", "Krug", "Lóbrego", "Picuchillo", "Escurridizo"];

export type MatchSummary = {
  summonerName?: string;
  champion?: string;
  win?: boolean;
  kills?: number;
  deaths?: number;
  assists?: number;
  csPerMin?: number;
  kda?: number;
};

type AiChatState = {
  coachName: string;
  isOpen: boolean;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  activeContext: { kind: ChatContextKind; match?: MatchSummary };
  openChat: (context?: ChatContextKind, match?: MatchSummary) => void;
  closeChat: () => void;
  sendMessage: (text: string) => boolean;
  retryLastRequest: () => void;
};

const AiChatContext = createContext<AiChatState | null>(null);

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [coachName, setCoachName] = useState("Coach");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const hasConversation = useRef(false);
  const lastRequest = useRef<{
    context: ChatContextKind;
    options?: { message?: string; match?: MatchSummary };
  } | null>(null);
  // Recordamos con qué contexto se abrió el chat (por ejemplo, la partida
  // analizada) para que una pregunta de seguimiento no pierda esos datos.
  const [activeContext, setActiveContext] = useState<
    { kind: ChatContextKind; match?: MatchSummary }
  >({ kind: "general" });

  useEffect(() => {
    setCoachName(`Coach ${JUNGLE_CAMPS[Math.floor(Math.random() * JUNGLE_CAMPS.length)]}`);
  }, []);

  useEffect(() => () => {
    const request = activeRequest.current;
    activeRequest.current = null;
    request?.abort();
  }, []);

  const fetchChat = useCallback(
    async (context: ChatContextKind, options?: { message?: string; match?: MatchSummary }) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      lastRequest.current = { context, options };
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${getBackendUrl()}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            context,
            message: options?.message,
            match: options?.match,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "No pudimos obtener una respuesta. Intenta de nuevo.");
        }
        const received: ChatMessage[] = Array.isArray(data?.messages)
          ? data.messages.filter((message: ChatMessage) => message?.role === "bot" && typeof message.text === "string" && message.text.trim())
          : [];
        if (!received.length) throw new Error("No recibimos una respuesta del coach. Intenta de nuevo.");
        if (activeRequest.current === controller) {
          setMessages((prev) => [...prev, ...received]);
        }
      } catch (err) {
        if (!controller.signal.aborted && activeRequest.current === controller) {
          setError(err instanceof Error && !(err instanceof TypeError)
            ? err.message
            : "No se pudo conectar con el coach. Revisa tu conexión e intenta de nuevo.");
        }
      } finally {
        if (activeRequest.current === controller) {
          activeRequest.current = null;
          setLoading(false);
        }
      }
    },
    [],
  );

  const openChat = useCallback(
    (context?: ChatContextKind, match?: MatchSummary) => {
      setIsOpen(true);
      if (context === undefined && hasConversation.current) return;
      hasConversation.current = true;
      const kind = context ?? "general";
      setMessages([]);
      setActiveContext({ kind, match });
      void fetchChat(kind, { match });
    },
    [fetchChat],
  );

  const closeChat = useCallback(() => setIsOpen(false), []);

  const sendMessage = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || activeRequest.current) return false;
      setMessages((prev) => [...prev, { role: "user", text: message }]);
      void fetchChat(activeContext.kind, { message, match: activeContext.match });
      return true;
    },
    [fetchChat, activeContext],
  );

  const retryLastRequest = useCallback(() => {
    if (activeRequest.current || !lastRequest.current) return;
    void fetchChat(lastRequest.current.context, lastRequest.current.options);
  }, [fetchChat]);

  return (
    <AiChatContext.Provider
      value={{ coachName, isOpen, messages, loading, error, activeContext, openChat, closeChat, sendMessage, retryLastRequest }}
    >
      {children}
    </AiChatContext.Provider>
  );
}

export function useAiChat(): AiChatState {
  const ctx = useContext(AiChatContext);
  if (!ctx) {
    throw new Error("useAiChat debe usarse dentro de un AiChatProvider");
  }
  return ctx;
}

export function useHasAiChatProvider() { return useContext(AiChatContext) !== null; }
