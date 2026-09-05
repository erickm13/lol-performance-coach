"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";
import { RiotAccountCard } from "./RiotAccountCard";

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

  async function handleLogout() {
    try {
      await fetch(`${getBackendUrl()}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/login");
    }
  }

  if (!me) return <p className="text-mist">Cargando...</p>;

  return (
    <div className="rune-stagger flex flex-col gap-8 w-full max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-mist text-sm">Bienvenido de vuelta</p>
          <p className="font-display text-xl font-semibold tracking-tight">
            Hola, {me.email}
          </p>
        </div>
        <button onClick={handleLogout} className="rune-btn">
          Cerrar sesión
        </button>
      </div>

      {!me.emailVerified && (
        <p
          role="alert"
          className="rune-panel px-5 py-3 text-sm text-gold border-l-4 border-l-gold"
        >
          Todavía no verificaste tu email.
        </p>
      )}

      <RiotAccountCard />

      <section className="rune-panel p-6">
        <h2 className="font-display text-lg font-semibold mb-4">
          Próximos pasos
        </h2>
        <ol className="flex flex-col gap-3 text-sm text-mist">
          <li className="flex gap-3">
            <span className="font-display text-teal">01</span>
            Vincular tu cuenta de Riot Games
          </li>
          <li className="flex gap-3">
            <span className="font-display text-teal">02</span>
            Cargar tus últimas partidas
          </li>
          <li className="flex gap-3">
            <span className="font-display text-teal">03</span>
            Ver tu primer plan de entrenamiento
          </li>
        </ol>
      </section>

      <section className="rune-panel p-6">
        <h2 className="font-display text-lg font-semibold mb-3">
          Qué vas a poder hacer acá
        </h2>
        <p className="text-sm text-mist leading-relaxed">
          Cuando vincules tu cuenta, vamos a analizar tus partidas recientes,
          detectar los patrones que más te están costando partidas, y armarte
          un plan de entrenamiento semanal con explicaciones ancladas a tus
          propias métricas — no consejos genéricos.
        </p>
      </section>
    </div>
  );
}
