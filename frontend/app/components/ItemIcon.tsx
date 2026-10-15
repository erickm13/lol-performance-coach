"use client";

import { dataDragonDescriptionText, type ItemDetails } from "../lib/dataDragon";
import { Tooltip } from "./Tooltip";

export function ItemIcon({
  itemId,
  version,
  item,
  loading,
  className = "",
}: {
  itemId: number;
  version: string;
  item?: ItemDetails;
  loading: boolean;
  className?: string;
}) {
  const name = item?.name ?? `Objeto ${itemId}`;
  const description = item
    ? dataDragonDescriptionText(item.description || item.plaintext || "")
    : loading
    ? "Cargando información del objeto..."
    : "La información de este objeto no está disponible en el catálogo de este parche.";

  return (
    <Tooltip
      label={name}
      className={`item-tooltip-trigger ${className}`}
      content={
        <>
          <strong className="tooltip-title">{name}</strong>
          <p className="tooltip-copy">{description || "Sin descripción disponible."}</p>
          {item?.gold && (
            <p className="tooltip-item-gold">
              {item.gold.purchasable ? `Costo: ${item.gold.total} de oro · ` : ""}
              Venta: {item.gold.sell} de oro
            </p>
          )}
          <p className="tooltip-caption">Parche {version}</p>
        </>
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`}
        alt=""
        className="mini-item"
      />
    </Tooltip>
  );
}
