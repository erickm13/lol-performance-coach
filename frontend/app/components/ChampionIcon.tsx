"use client";

import { useEffect, useState } from "react";
import { dataDragonDescriptionText, loadChampionDetails, type ChampionAbility, type ChampionDetails } from "../lib/dataDragon";
import { Tooltip } from "./Tooltip";

const CLASS_LABELS: Record<string, string> = {
  Fighter: "Luchador",
  Tank: "Tanque",
  Mage: "Mago",
  Assassin: "Asesino",
  Support: "Soporte",
  Marksman: "Tirador",
};

function Ability({ ability, label, version, passive = false }: {
  ability: ChampionAbility;
  label: string;
  version: string;
  passive?: boolean;
}) {
  return (
    <div className="champion-tooltip-ability">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/${passive ? "passive" : "spell"}/${ability.image.full}`} alt="" />
      <div>
        <p className="champion-tooltip-ability-name"><span>{label}</span> {ability.name}</p>
        <p className="tooltip-copy">{dataDragonDescriptionText(ability.description)}</p>
      </div>
    </div>
  );
}

type ChampionLoadState = {
  key: string;
  status: "loading" | "ready" | "error";
  details?: ChampionDetails;
};

export function ChampionIcon({ champion, version, className }: {
  champion: string;
  version: string;
  className: "mini-champ" | "champ-icon-sm";
}) {
  const key = `${version}/${champion}`;
  const [requested, setRequested] = useState(false);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<ChampionLoadState | null>(null);
  const details = state?.key === key ? state.details : undefined;
  const failed = state?.key === key && state.status === "error";

  useEffect(() => {
    if (!requested) return;
    let active = true;
    const requestKey = `${version}/${champion}`;
    setState({ key: requestKey, status: "loading" });
    loadChampionDetails(champion, version)
      .then((data) => {
        if (active) setState({ key: requestKey, status: "ready", details: data });
      })
      .catch(() => {
        if (active) setState({ key: requestKey, status: "error" });
      });
    return () => { active = false; };
  }, [champion, version, requested, retry]);

  return (
    <Tooltip
      label={details?.name ?? champion}
      className={`champion-tooltip-trigger ${className}`}
      popupClassName="champion-tooltip"
      onOpen={() => {
        setRequested(true);
        if (failed) setRetry((value) => value + 1);
      }}
      content={
        <>
          <strong className="tooltip-title">{details?.name ?? champion}</strong>
          {details ? (
            <>
              <p className="champion-tooltip-subtitle">{details.title}</p>
              <p className="champion-tooltip-classes">{details.tags.map((tag) => CLASS_LABELS[tag] ?? tag).join(" · ")}</p>
              <Ability ability={details.passive} label="Pasiva" version={version} passive />
              {details.spells.slice(0, 4).map((ability, index) => (
                <Ability key={index} ability={ability} label={["Q", "W", "E", "R"][index]} version={version} />
              ))}
            </>
          ) : (
            <p className="tooltip-copy" role="status">
              {failed
                ? "No se pudo cargar la información. Vuelve a abrir el tooltip para reintentar."
                : "Cargando información del campeón..."}
            </p>
          )}
          <p className="tooltip-caption">Parche {version}</p>
        </>
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion}.png`} alt="" className={className} />
    </Tooltip>
  );
}
