import type { DataDragonAssets } from "../lib/useDataDragon";
import type { RawStats } from "../lib/matches";
import { ItemIcon } from "./ItemIcon";
import { SummonerSpellIcon } from "./SummonerSpellIcon";
export function MatchBuild(
  { stats, assets }: { stats: RawStats | null; assets: DataDragonAssets },
) {
  return (
    <div className="history-build" aria-label="Objetos de la partida">
      <div className="history-build-items">
        {Array.from({ length: 6 }, (_, i) => stats?.[`item${i}`]).map((id, i) =>
          id
            ? (
              <ItemIcon
                key={i}
                itemId={id}
                version={assets.version}
                item={assets.items[id]}
                loading={assets.loading}
              />
            )
            : null
        )}
      </div>
      {!!stats?.item6 && (
        <ItemIcon
          className="history-trinket"
          itemId={stats.item6}
          version={assets.version}
          item={assets.items[stats.item6]}
          loading={assets.loading}
        />
      )}
    </div>
  );
}
export function MatchSpells(
  { stats, assets }: { stats: RawStats | null; assets: DataDragonAssets },
) {
  return (
    <div className="history-spells">
      {[stats?.summoner1Id, stats?.summoner2Id].map((id, i) =>
        id
          ? (
            <SummonerSpellIcon
              key={i}
              spellId={id}
              version={assets.version}
              spell={assets.spells[id]}
              loading={assets.loading}
            />
          )
          : null
      )}
    </div>
  );
}
