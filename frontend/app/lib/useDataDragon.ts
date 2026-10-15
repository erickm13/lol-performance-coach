"use client";
import { useEffect, useState } from "react";
import {
  DEFAULT_DDRAGON_VERSION,
  type ItemCatalog,
  loadItemCatalog,
  loadSummonerSpellCatalog,
  type SummonerSpellCatalog,
} from "./dataDragon";
export function useDataDragon() {
  const [version, setVersion] = useState(DEFAULT_DDRAGON_VERSION);
  const [items, setItems] = useState<ItemCatalog>({});
  const [spells, setSpells] = useState<SummonerSpellCatalog>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
      signal: controller.signal,
    })
      .then((r) => r.ok ? r.json() : []).then((v: string[]) => {
        if (!controller.signal.aborted && /^\d+\.\d+\.\d+$/.test(v[0] ?? "")) {
          setVersion(v[0]);
        }
      }).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      loadItemCatalog(version),
      loadSummonerSpellCatalog(version),
    ]).then(([i, s]) => {
      if (!active) return;
      setItems(i.status === "fulfilled" ? i.value : {});
      setSpells(s.status === "fulfilled" ? s.value : {});
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [version]);
  return { version, items, spells, loading };
}
export type DataDragonAssets = ReturnType<typeof useDataDragon>;
