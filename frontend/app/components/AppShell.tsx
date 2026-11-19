"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ChatScope } from "./ChatScope";
import { useResource } from "../lib/useResource";
import { ProfileReminder } from "./ProfileReminder";
import { ScreenState } from "./ScreenState";
import { SessionContext, type SessionUser } from "../lib/session";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const session = useResource<SessionUser>("/auth/me");
  return (
    <div className="shell">
      {open && <Sidebar onNavigate={() => setOpen(false)} />}
      <main className="stage">
        <div className="stage-inner">
          <TopBar onToggleMenu={() => setOpen((o) => !o)} menuOpen={open} />
          {session.loading
            ? <ScreenState title="Cargando tu sesión…" />
            : session.error
            ? (
              <ScreenState
                title="No pudimos cargar tu sesión"
                retry={session.reload}
              >
                {session.error}
              </ScreenState>
            )
            : (
              <SessionContext.Provider value={session.data}>
                <ChatScope><ProfileReminder />{children}</ChatScope>
              </SessionContext.Provider>
            )}
        </div>
      </main>
    </div>
  );
}
