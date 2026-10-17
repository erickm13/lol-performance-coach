"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveDraft } from "../lib/useLiveDraft";
import { liveDraftInput } from "../lib/liveDraft";
import { LiveDraftPanel } from "./LiveDraftPanel";
import { apiRequest, useResource } from "../lib/useResource";
import { type ChampionSummary } from "../lib/dataDragon";
import { type ProfileResponse, ROLES } from "../lib/player";
import {
  type DraftInput,
  type PreparationAnalytics,
  type PreparationGuide,
} from "../lib/preparation";
import { ScrollRevealRoot } from "./ScrollRevealRoot";
import { ScreenState } from "./ScreenState";
const CDN = "https://ddragon.leagueoflegends.com/cdn";
function LoLalyticsBuild({ guide, mode, stale }: {
  guide: PreparationGuide;
  mode: "manual" | "live";
  stale: boolean;
}) {
  const data = guide.analytics;
  const role = ROLES.find((item) => item.id === guide.input.role)?.name ?? guide.input.role;
  const laneParam = guide.input.role === "UTILITY" ? "support" : guide.input.role.toLowerCase();
  const rate = (value: number | null) => value === null ? "—" : `${value.toFixed(2)}%`;
  const count = (value: number | null) => value === null ? "—" : value.toLocaleString("es-GT");
  const itemCard = (item: PreparationAnalytics["startingItems"][number], index: number) => (
    <div className="lolytics-item" key={`${item.id}-${index}`} title={item.name}>
      <Image unoptimized width={44} height={44} src={`https://cdn5.lolalytics.com/item64/${item.id}.webp`} alt={item.name} />
      <strong>{item.name}</strong>
      {item.winRate !== null && <span className="lolytics-winrate">{rate(item.winRate)}</span>}
      {item.games !== null && <small>{count(item.games)} partidas</small>}
    </div>
  );
  const abilityRows = ["Q", "W", "E", "R"] as const;
  const selectedPrimaryRunes = new Set(guide.runes.primary.map((rune) => rune.id));
  const selectedSecondaryRunes = new Set(guide.runes.secondary.map((rune) => rune.id));
  const runeIcon = (rune: PreparationGuide["runes"]["primary"][number], selected: boolean, key: string, statMod = false) => (
    <Image
      unoptimized
      key={key}
      width={36}
      height={36}
      className={selected ? "is-selected" : "is-muted"}
      title={`${rune.name}${selected ? " · seleccionada" : ""}`}
      src={statMod ? rune.sourceIcon ?? `${CDN}/img/${rune.icon}` : `${CDN}/img/${rune.icon}`}
      alt={rune.name}
      aria-label={`${rune.name}${selected ? ", seleccionada" : ", no seleccionada"}`}
    />
  );

  if (!data) {
    return (
      <section className="lolytics-build lolytics-unavailable" aria-live="polite">
        <header><span>LoLalytics · {guide.chosen.name}</span><span>Parche {guide.version}</span></header>
        <h2>No pudimos cargar la build de esta línea</h2>
        <p>La guía muestra datos de LoLalytics para campeón y línea. No se reemplaza por las plantillas anteriores cuando la fuente no está disponible.</p>
        {stale && <p role="status">La selección cambió; estos datos corresponden al campeón anterior.</p>}
        <a href={`https://lolalytics.com/lol/${guide.chosen.id.toLowerCase()}/build/?lane=${laneParam}&tier=${guide.rankFilter}&region=lan`} target="_blank" rel="noreferrer">Abrir la página de LoLalytics ({guide.rankLabel}) →</a>
      </section>
    );
  }

  return (
    <div className="lolytics-page" aria-live={mode === "manual" ? "polite" : undefined}>
      <div className="lolytics-breadcrumb">LoL Tier List / {guide.chosen.name}{data.matchup ? ` vs ${data.matchup.opponent}` : ""} Build</div>
      {mode === "live" && <p className="lolytics-live-status" role="status">{stale ? "Selección actualizándose…" : "Build ligada a la selección en vivo"}</p>}
      <section className="lolytics-hero">
        <div className="lolytics-portrait-wrap">
          <Image unoptimized width={152} height={152} src={`${CDN}/${guide.version}/img/champion/${guide.chosen.id}.png`} alt={guide.chosen.name} />
          <span>{data.summary.tier ?? "—"}</span>
        </div>
        <div className="lolytics-intro">
          <h1>{guide.chosen.name} Build, Runas y Habilidades para {role}{data.matchup ? ` contra ${data.matchup.opponent}` : ""}</h1>
          <div className="lolytics-priority-mini" aria-label="Prioridad de habilidades">
            {data.skillPriority.sequence.map((key, index) => {
              const skill = guide.skills.find((item) => item.key === key);
              return <span key={`${key}-${index}`}>{skill && <Image unoptimized width={34} height={34} src={`${CDN}/${guide.version}/img/spell/${skill.image.full}`} alt={skill.name} />}<b>{key}</b>{index < data.skillPriority.sequence.length - 1 && <i>›</i>}</span>;
            })}
          </div>
          <p>
            {guide.chosen.name} {role.toLowerCase()} · parche {data.patch ?? guide.version} · tasa de victoria {rate(data.summary.winRate)}
            {data.summary.rank !== null && data.summary.totalChampions !== null ? ` · puesto ${data.summary.rank} de ${data.summary.totalChampions}` : ""}
            {data.summary.tier ? ` · rango ${data.summary.tier}` : ""}.
          </p>
        </div>
      </section>

      <section className="lolytics-metrics" aria-label="Estadísticas del campeón y línea">
        {(data.matchup ? [
          [rate(data.summary.winRate), `Win Rate vs ${data.matchup.opponent}`],
          [count(data.summary.games), "Games"],
        ] : [
          [rate(data.summary.winRate), "Win Rate"],
          [rate(data.summary.winRateDelta), "WR Delta"],
          [rate(data.summary.gameAverageWinRate), "Game Avg WR"],
          [rate(data.summary.pickRate), "Pick Rate"],
          [data.summary.tier ?? "—", "Tier"],
          [data.summary.rank !== null && data.summary.totalChampions !== null ? `${data.summary.rank} / ${data.summary.totalChampions}` : "—", "Rank"],
          [rate(data.summary.banRate), "Ban Rate"],
          [count(data.summary.games), "Games"],
        ]).map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </section>

      <div className="lolytics-build-switch"><span className="is-active">{data.matchup ? `Enfrentamiento contra ${data.matchup.opponent}` : "Build principal"}</span><span>Rango {guide.rankLabel}{guide.rankBoosted ? " · rango de aliados" : ""} · LAN · {data.patch ?? guide.version}</span></div>

      <section id="lolytics-build" className="lolytics-main-grid">
        <article className="lolytics-block lolytics-priority-block">
          <h2>Skill Priority <small>· {rate(data.skillPriority.winRate)} · {count(data.skillPriority.games)} partidas</small></h2>
          <div className="lolytics-priority-large">
            {data.skillPriority.sequence.map((key, index) => {
              const skill = guide.skills.find((item) => item.key === key);
              return <span key={`${key}-${index}`}>{skill && <Image unoptimized width={42} height={42} src={`${CDN}/${guide.version}/img/spell/${skill.image.full}`} alt={skill.name} />}<b>{key}</b>{index < data.skillPriority.sequence.length - 1 && <i>›</i>}</span>;
            })}
          </div>
          <h3>Summoner Spells</h3>
          <div className="lolytics-spells">
            {data.summonerSpells.map((spell) => <span key={spell.id} title={spell.name}><Image unoptimized width={42} height={42} src={`https://cdn5.lolalytics.com/spell64/${spell.id}.webp`} alt={spell.name} /><b>{spell.name}</b></span>)}
          </div>
          <p className="lolytics-footnote">{rate(data.summonerSpells[0]?.winRate ?? null)} Win Rate · {count(data.summonerSpells[0]?.games ?? null)} partidas</p>
        </article>

        <article id="lolytics-skills" className="lolytics-block lolytics-order-block">
          <h2>Skill Order <small>· {rate(data.skillOrder.winRate)} · {count(data.skillOrder.games)} partidas</small></h2>
          <div className="lolytics-skill-scroll"><table><thead><tr><th></th>{data.skillOrder.sequence.map((_, index) => <th key={index}>{index + 1}</th>)}</tr></thead><tbody>
            {abilityRows.map((key) => {
              const skill = guide.skills.find((item) => item.key === key);
              return <tr key={key}><th>{skill && <Image unoptimized width={26} height={26} src={`${CDN}/${guide.version}/img/spell/${skill.image.full}`} alt={skill.name} />}<b>{key}</b></th>{data.skillOrder.sequence.map((chosen, index) => <td className={chosen === key ? "is-active" : ""} key={index}>{chosen === key ? index + 1 : ""}</td>)}</tr>;
            })}
          </tbody></table></div>
        </article>

        <article className="lolytics-block lolytics-runes-block">
          <h2>Runas</h2>
          <div className="lolytics-rune-columns">
            <div className="lolytics-rune-tree"><h3>{guide.runes.primaryTree?.name ?? "Rama principal"}</h3><div className="lolytics-rune-rows">{guide.runes.primarySlots.map((slot, row) => <div className="lolytics-rune-row" key={`primary-${row}`} style={{ gridTemplateColumns: `repeat(${slot.length}, 36px)` }}>{slot.map((rune) => runeIcon(rune, selectedPrimaryRunes.has(rune.id), `primary-${rune.id}`))}</div>)}</div></div>
            <div className="lolytics-rune-tree"><h3>{guide.runes.secondaryTree?.name ?? "Secundaria"}</h3><div className="lolytics-rune-rows">{guide.runes.secondarySlots.map((slot, row) => <div className="lolytics-rune-row" key={`secondary-${row}`} style={{ gridTemplateColumns: `repeat(${slot.length}, 36px)` }}>{slot.map((rune) => runeIcon(rune, selectedSecondaryRunes.has(rune.id), `secondary-${rune.id}`))}</div>)}</div></div>
          </div>
          <h3>Stat Mods</h3>
          <div className="lolytics-stat-grid">{guide.runes.statModOptions.map((rune, index) => runeIcon(rune, guide.runes.statModSelection[index] ?? false, `stat-${index}`, true))}</div>
          <p className="lolytics-footnote">{rate(guide.runes.winRate)} Win Rate · {count(guide.runes.sampleGames)} partidas</p>
        </article>
      </section>

      <section id="lolytics-items" className="lolytics-items-grid">
        <article className="lolytics-block"><h2>Starting Items</h2><div className="lolytics-items-row">{data.startingItems.map(itemCard)}</div></article>
        <article className="lolytics-block"><h2>Core Build <small>· {rate(data.coreBuild.winRate)} · {count(data.coreBuild.games)} partidas</small></h2><div className="lolytics-items-row lolytics-core-items">{data.coreItems.map((item, index) => <span className="lolytics-core-step" key={item.id}>{itemCard(item, index)}{index < data.coreItems.length - 1 && <b>›</b>}</span>)}</div></article>
        {data.situationalItems.map((slot) => <article className="lolytics-block" key={slot.slot}><h2>Item {slot.slot}</h2><div className="lolytics-items-row">{slot.options.map((item, index) => <span className="lolytics-item-option" key={`${item.id}-${index}`}>{index > 0 && <b>OR</b>}{itemCard(item, index)}</span>)}</div></article>)}
      </section>
      {guide.warnings.length > 0 && <div className="lolytics-warnings">{guide.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    </div>
  );
}
export function PreparationView() {
  const catalog = useResource<
    { version: string; champions: ChampionSummary[] }
  >("/preparation/catalog");
  const profile = useResource<ProfileResponse>("/player/profile");
  const [mode, setMode] = useState<"live" | "manual">("live");
  const [liveRole, setLiveRole] = useState("");
  const live = useLiveDraft(mode === "live");
  const lastLiveId = useRef<string | null>(null);
  const [draft, setDraft] = useState<DraftInput>({
    role: "",
    champion: null,
    allies: [],
    enemies: [],
  });
  const [guide, setGuide] = useState<PreparationGuide | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const touched = useRef(false),
    results = useRef<HTMLDivElement>(null),
    request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const role = profile.data?.profile?.primaryRole;
    if (mode === "manual" && role && !touched.current) {
      setDraft((current) => current.role ? current : ({ ...current, role }));
    }
  }, [profile.data, mode]);
  const patch = (value: Partial<DraftInput>) => {
    touched.current = true;
    setDraft((current) => ({ ...current, ...value }));
  };
  const champions = catalog.data?.champions ?? [],
    version = catalog.data?.version ?? "";
  const occupied = new Set(
    [draft.champion, ...draft.allies, ...draft.enemies].filter(Boolean),
  );
  const filtered = champions.filter((champion) =>
    `${champion.name} ${champion.id}`.toLowerCase().includes(
      search.trim().toLowerCase(),
    )
  );
  const stale = Boolean(guide && JSON.stringify(guide.input) !== JSON.stringify(draft));
  const prepare = useCallback(async (input: DraftInput, scroll = true, liveDraftId?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<PreparationGuide>("/preparation/guide", {
        method: "POST",
        body: JSON.stringify(liveDraftId ? { ...input, liveDraftId } : input),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setGuide(data);
        if (scroll) {
          requestAnimationFrame(() =>
            results.current?.scrollIntoView({
              behavior:
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              block: "start",
            })
          );
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(
          err instanceof Error ? err.message : "No se pudo preparar la guía.",
        );
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }, []);
  const liveModel = liveDraftInput(live.state.snapshot, champions, liveRole);
  const liveSignature = JSON.stringify(liveModel.input);
  const enemyRoleSignature = JSON.stringify(
    live.state.snapshot?.theirTeam.map((slot) => [slot.championId, slot.role, slot.lockedIn]) ?? [],
  );
  const livePhase = live.state.snapshot?.phase;
  const liveId = live.state.snapshot?.draftId ?? null;
  useEffect(() => {
    if (mode !== "live") return;
    request.current?.abort();
    request.current = null;
    setLoading(false);
    if (!live.state.connected || livePhase !== "ChampSelect") return;
    if (lastLiveId.current !== liveId) {
      lastLiveId.current = liveId;
      setGuide(null);
    }
    if (liveSignature === "null") {
      setGuide(null);
      return;
    }
    const input = JSON.parse(liveSignature) as DraftInput;
    setDraft(input);
    setError(null);
    const timer = setTimeout(() => {
      void prepare(input, false, liveId ?? undefined);
    }, 600);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
      request.current = null;
    };
  }, [mode, liveSignature, enemyRoleSignature, liveId, livePhase, live.state.connected, prepare]);
  function switchMode(next: "live" | "manual") {
    if (next === mode) return;
    request.current?.abort();
    request.current = null;
    setMode(next);
    setGuide(null);
    setError(null);
    setLoading(false);
    if (next === "manual") {
      setDraft((current) => ({
        role: current.role,
        champion: current.champion,
        allies: current.allies,
        enemies: current.enemies,
      }));
    }
  }
  function selector(
    key: "champion" | "allies" | "enemies",
    label: string,
    max: number,
  ) {
    const selected = key === "champion"
      ? draft.champion ? [draft.champion] : []
      : draft[key];
    return (
      <fieldset className="draft-team">
        <legend>
          {label} {key !== "champion" && <span>{selected.length}/{max}</span>}
        </legend>
        <label className="field-label">
          <span className="sr-only">Añadir {label.toLowerCase()}</span>
          <select
            className="rune-field"
            value={key === "champion" ? draft.champion ?? "" : ""}
            disabled={!champions.length ||
              (key !== "champion" && selected.length >= max)}
            onChange={(event) => {
              if (key === "champion") {
                patch({
                  champion: event.target.value || null,
                });
              } else if (event.target.value) {
                patch({
                  [key]: [...draft[key], event.target.value],
                });
              }
            }}
          >
            <option value="">
              {key === "champion"
                ? "Recomiéndame una opción"
                : "Añadir campeón"}
            </option>
            {champions.filter((champion) =>
              (!occupied.has(champion.id) || selected.includes(champion.id)) &&
              (selected.includes(champion.id) ||
                filtered.some((item) => item.id === champion.id))
            ).map((champion) => (
              <option
                key={champion.id}
                value={champion.id}
                disabled={key !== "champion" && selected.includes(champion.id)}
              >
                {champion.name}
              </option>
            ))}
          </select>
        </label>
        <div className="draft-champions">
          {selected.map((id) => (
            <button
              type="button"
              className="profile-chip"
              key={id}
              aria-label={`Quitar ${
                champions.find((champion) => champion.id === id)?.name ?? id
              }`}
              onClick={() =>
                key === "champion" ? patch({ champion: null }) : patch({
                  [key]: draft[key].filter((entry) => entry !== id),
                })}
            >
              <Image
                unoptimized
                width={36}
                height={36}
                src={`${CDN}/${version}/img/champion/${id}.png`}
                alt=""
              />
              {champions.find((champion) => champion.id === id)?.name ?? id}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <ScrollRevealRoot className="screen-stack motion-page preparation-page">
      <header className="page-head" data-reveal="up">
        <div>
          <h2>Prepara tu próxima partida</h2>
          <p className="page-sub">
            {mode === "live"
              ? "Conecta el cliente de LoL: tu guía se prepara con los campeones que van eligiendo ambos equipos."
              : "Simula una selección de ambos equipos para revisar la guía antes de entrar a una partida."}
          </p>
        </div>
        <Link href="/dashboard/perfil" className="rune-link">
          Mis campeones habituales →
        </Link>
      </header>
      <div
        className="preparation-mode-switch learning-filter"
        role="group"
        aria-label="Origen de la selección"
      >
        <button
          type="button"
          aria-pressed={mode === "live"}
          onClick={() => switchMode("live")}
        >
          Desde el cliente · En vivo
        </button>
        <button
          type="button"
          aria-pressed={mode === "manual"}
          onClick={() => switchMode("manual")}
        >
          Simular selección
        </button>
      </div>
      {mode === "live" && (
        <LiveDraftPanel
          state={live.state}
          error={live.error}
          reload={live.reload}
          champions={champions}
          version={version}
          role={liveRole}
          onRoleChange={setLiveRole}
          reason={liveModel.reason}
        />
      )}
      {mode === "live" && loading && (
        <p className="preparation-live-feedback" role="status">
          Actualizando tu guía con la selección…
        </p>
      )}
      {mode === "live" && error && (
        <div className="preparation-notice" role="alert">
          {error}
          <button
            type="button"
            className="rune-link"
            disabled={loading || !live.state.connected || !liveModel.input}
            onClick={() => {
              if (liveModel.input) {
                void prepare(liveModel.input, false);
              }
            }}
          >
            Reintentar guía →
          </button>
        </div>
      )}
      {catalog.error
        ? (
          <ScreenState
            title="No pudimos cargar los campeones"
            retry={catalog.reload}
          >
            {catalog.error}
          </ScreenState>
        )
        : !catalog.data
        ? <ScreenState title="Cargando el catálogo de Riot…" />
        : mode === "manual" && (
          <form
            className="section-surface"
            data-reveal="up"
            onSubmit={(event) => {
              event.preventDefault();
              void prepare(draft);
            }}
          >
            <header className="champ-stats-head">
              <h3>Tu selección manual</h3>
              <span>Parche {version} · Grieta del Invocador</span>
            </header>
            <div className="section-body">
              <div className="profile-field-grid">
                <label className="field-label">
                  Tu línea<select
                    className="rune-field"
                    required
                    value={draft.role}
                    onChange={(event) => patch({ role: event.target.value })}
                  >
                    <option value="">Elige tu línea</option>
                    {ROLES.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Filtrar campeones<input
                    className="rune-field"
                    type="search"
                    value={search}
                    placeholder="Buscar en las tres selecciones…"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
              <div className="draft-grid">
                {selector("champion", "Tu campeón", 1)}
                {selector("allies", "Tus aliados", 4)}
                {selector("enemies", "Tus rivales", 5)}
              </div>
              <p className="page-sub">
                Puedes dejar posiciones pendientes. Añadir aliados y rivales
                permite considerar más opciones de composición. Esta selección
                se introduce manualmente.
              </p>
              <div className="profile-save-actions">
                <button className="rune-btn" disabled={loading || !draft.role}>
                  {loading ? "Preparando opciones…" : "Preparar mi guía"}
                </button>
                {guide && (
                  <button
                    type="button"
                    className="rune-link"
                    disabled={loading}
                    onClick={() => {
                      patch({ champion: null, allies: [], enemies: [] });
                      setGuide(null);
                      setError(null);
                    }}
                  >
                    Limpiar selección
                  </button>
                )}
              </div>
              {error && <p role="alert" className="text-ember">{error}</p>}
            </div>
          </form>
        )}
      {guide && (
        <div
          ref={results}
          className="preparation-results screen-stack"
          aria-live={mode === "manual" ? "polite" : undefined}
        >
          <LoLalyticsBuild guide={guide} mode={mode} stale={stale} />
        </div>
      )}
    </ScrollRevealRoot>
  );
}
