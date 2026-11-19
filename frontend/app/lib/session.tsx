"use client";
import { createContext, useContext } from "react";

export type SessionUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  legalNoticeAcceptedAt?: string | null;
};

// AppShell already loads /auth/me; pages inside it read that result instead of
// waiting for a second request before they can render.
export const SessionContext = createContext<SessionUser | null>(null);

export function useSessionUser() {
  return useContext(SessionContext);
}
