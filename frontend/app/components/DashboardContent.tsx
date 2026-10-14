"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";
import { RiotAccountCard } from "./RiotAccountCard";
import { DashboardTeasers } from "./DashboardTeasers";
import { AiChatProvider } from "./AiChatContext";
import { AiChatFab, AiChatWidget } from "./AiChatWidget";

type Me = { id: string; email: string; emailVerified: boolean };

export function DashboardContent() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch(`${getBackendUrl()}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setMe(data);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  if (!me) return <p className="text-mist">Cargando...</p>;

  return (
    <AiChatProvider>
      <div className="rune-stagger flex flex-col gap-8 w-full max-w-3xl">
        {!me.emailVerified && (
          <p
            role="alert"
            className="rune-panel px-5 py-3 text-sm text-gold border-l-4 border-l-gold"
          >
            Todavía no verificaste tu email.
          </p>
        )}

        <RiotAccountCard emailVerified={me.emailVerified} />
        <DashboardTeasers />
      </div>
      <AiChatFab />
      <AiChatWidget />
    </AiChatProvider>
  );
}
