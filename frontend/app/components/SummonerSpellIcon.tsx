"use client";

import { dataDragonDescriptionText, type SummonerSpellDetails } from "../lib/dataDragon";
import { Tooltip } from "./Tooltip";

const SPELL_FALLBACKS: Record<number, { image: string; name: string }> = {
  1: { image: "SummonerBoost", name: "Limpiar" },
  3: { image: "SummonerExhaust", name: "Extenuación" },
  4: { image: "SummonerFlash", name: "Flash" },
  6: { image: "SummonerHaste", name: "Fantasma" },
  7: { image: "SummonerHeal", name: "Curación" },
  11: { image: "SummonerSmite", name: "Castigo" },
  12: { image: "SummonerTeleport", name: "Teletransportación" },
  13: { image: "SummonerMana", name: "Claridad" },
  14: { image: "SummonerDot", name: "Ignite" },
  21: { image: "SummonerBarrier", name: "Barrera" },
  32: { image: "SummonerSnowball", name: "Marca" },
};

export function SummonerSpellIcon({
  spellId,
  version,
  spell,
  loading,
}: {
  spellId: number;
  version: string;
  spell?: SummonerSpellDetails;
  loading: boolean;
}) {
  const fallback = SPELL_FALLBACKS[spellId];
  const name = spell?.name ?? fallback?.name ?? `Hechizo ${spellId}`;
  const image = spell?.image.full ?? (fallback ? `${fallback.image}.png` : null);

  return (
    <Tooltip
      label={name}
      className="spell-tooltip-trigger"
      content={
        <>
          <strong className="tooltip-title">{name}</strong>
          <p className="tooltip-copy">
            {spell
              ? dataDragonDescriptionText(spell.description)
              : loading
              ? "Cargando información del hechizo..."
              : "La información de este hechizo no está disponible en el catálogo de este parche."}
          </p>
          {spell?.cooldownBurn && (
            <p className="tooltip-caption">Enfriamiento base: {spell.cooldownBurn} s</p>
          )}
          <p className="tooltip-caption">Parche {version}</p>
        </>
      }
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${image}`} alt="" className="mini-spell" />
      ) : <span className="mini-spell" />}
    </Tooltip>
  );
}
