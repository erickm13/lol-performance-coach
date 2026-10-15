"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useResource } from "../lib/useResource";
import type { HistoryResponse } from "../lib/matches";
import { ScreenState } from "./ScreenState";
export function LatestMatch() {
  const router = useRouter();
  const { data, error, reload } = useResource<HistoryResponse>(
    "/riot/matches?limit=1",
  );
  const id = data?.matches[0]?.match.id;
  useEffect(() => {
    if (id) router.replace(`/dashboard/partida/${id}`);
  }, [id, router]);
  if (error) {
    return (
      <ScreenState title="No pudimos cargar tu última partida" retry={reload}>
        {error}
      </ScreenState>
    );
  }
  if (!data || id) return <ScreenState title="Abriendo tu última partida…" />;
  return (
    <ScreenState
      title="Todavía no tienes partidas guardadas"
      link={{ href: "/dashboard", label: "Ir al dashboard" }}
    >
      Vincula tu cuenta y sincroniza tus partidas para consultar sus detalles.
    </ScreenState>
  );
}
