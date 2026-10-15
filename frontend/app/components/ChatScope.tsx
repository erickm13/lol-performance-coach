"use client";
import { AiChatProvider, useHasAiChatProvider } from "./AiChatContext";
import { AiChatFab, AiChatWidget } from "./AiChatWidget";
export function ChatScope({ children }: { children: React.ReactNode }) {
  const shared = useHasAiChatProvider();
  if (shared) return <>{children}</>;
  return (
    <AiChatProvider>
      {children}
      <AiChatFab />
      <AiChatWidget />
    </AiChatProvider>
  );
}
