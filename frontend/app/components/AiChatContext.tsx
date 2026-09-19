"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { getBackendUrl } from "../lib/api";

type ChatMessage = { role: "bot" | "user"; text: string };
type ChatContextKind = "general" | "match";

export type MatchSummary = {
  champion?: string;
  win?: boolean;
  kills?: number;
  deaths?: number;
  assists?: number;
  csPerMin?: number;
  kda?: number;
};

type AiChatState = {
  isOpen: boolean;
  messages: ChatMessage[];
  loading: boolean;
  openChat: (context?: ChatContextKind, match?: MatchSummary) => void;
  closeChat: () => void;
  sendMessage: (text: string) => void;
};

const AiChatContext = createContext<AiChatState | null>(null);

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChat = useCallback(
    async (context: ChatContextKind, options?: { message?: string; match?: MatchSummary }) => {
      setLoading(true);
      try {
        const res = await fetch(`${getBackendUrl()}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            context,
            message: options?.message,
            match: options?.match,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setMessages((prev) => [...prev, ...(data.messages ?? [])]);
      } catch {
        // Sin conexión: dejamos los mensajes ya mostrados como están.
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const openChat = useCallback(
    (context: ChatContextKind = "general", match?: MatchSummary) => {
      setIsOpen(true);
      setMessages([]);
      fetchChat(context, { match });
    },
    [fetchChat],
  );

  const closeChat = useCallback(() => setIsOpen(false), []);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setMessages((prev) => [...prev, { role: "user", text }]);
      fetchChat("general", { message: text });
    },
    [fetchChat],
  );

  return (
    <AiChatContext.Provider
      value={{ isOpen, messages, loading, openChat, closeChat, sendMessage }}
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
