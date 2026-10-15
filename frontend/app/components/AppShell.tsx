"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      {open && <Sidebar />}
      <main className="stage">
        <div className="stage-inner">
          <TopBar onToggleMenu={() => setOpen((o) => !o)} menuOpen={open} />
          {children}
        </div>
      </main>
    </div>
  );
}
