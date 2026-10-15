"use client";
import { useEffect, useState } from "react";
import {
  type ChampionSummary,
  DEFAULT_DDRAGON_VERSION,
  loadChampionCatalog,
} from "./dataDragon";
export function useChampionCatalog() {
  const [champions, setChampions] = useState<ChampionSummary[]>([]);
  const [version, setVersion] = useState(DEFAULT_DDRAGON_VERSION);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    (async () => {
      let current = DEFAULT_DDRAGON_VERSION;
      try {
        const response = await fetch(
          "https://ddragon.leagueoflegends.com/api/versions.json",
        );
        const data = response.ok ? await response.json() : [];
        if (/^\d+\.\d+\.\d+$/.test(data[0] ?? "")) current = data[0];
      } catch {
        /* Try the bundled version when the version list is unavailable. */
      }
      const catalog = await loadChampionCatalog(current);
      if (active) {
        setChampions(catalog);
        setVersion(current);
      }
    })().catch(() => {
      if (active) {
        setError(
          "No se pudo cargar la selección de campeones. Puedes guardar el resto de tu perfil y reintentar.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [revision]);
  return {
    champions,
    version,
    error,
    retry: () => setRevision((old) => old + 1),
  };
}
