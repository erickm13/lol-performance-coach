"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveDraft } from "../lib/useLiveDraft";
import { liveDraftInput } from "../lib/liveDraft";
import { LiveDraftPanel } from "./LiveDraftPanel";
import { apiRequest, useResource } from "../lib/useResource";
import {
  type ChampionSummary,
  dataDragonDescriptionText,
} from "../lib/dataDragon";
import { type ProfileResponse, ROLES } from "../lib/player";
import {
  type DraftInput,
  type PreparationGuide,
  type PreparationItem,
  type PreparationRune,
  type PreparationSpell,
} from "../lib/preparation";
import { ScrollRevealRoot } from "./ScrollRevealRoot";
import { ScreenState } from "./ScreenState";
import { AcademyText } from "./AcademyText";
import { CountUp } from "./CountUp";
import { Tooltip } from "./Tooltip";
const CDN = "https://ddragon.leagueoflegends.com/cdn";
function CatalogText({ html }: { html: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(dataDragonDescriptionText(html));
  }, [html]);
  return (
    <span className="catalog-text">
      {text || "Consulta el efecto en el cliente antes de elegirlo."}
    </span>
  );
}
function Rune({ rune }: { rune: PreparationRune }) {
  return (
    <Tooltip
      label={rune.name}
      content={
        <>
          <strong className="tooltip-title">{rune.name}</strong>
          <p className="tooltip-copy">
            <CatalogText html={rune.longDesc || rune.shortDesc} />
          </p>
        </>
      }
    >
      <Image
        unoptimized
        width={44}
        height={44}
        src={`${CDN}/img/${rune.icon}`}
        alt=""
      />
      <span>{rune.name}</span>
    </Tooltip>
  );
}
function Spell(
  { spell, version }: { spell: PreparationSpell; version: string },
) {
  return (
    <div className="preparation-spell">
      <Tooltip
        label={spell.name}
        content={
          <>
            <strong className="tooltip-title">{spell.name}</strong>
            <p className="tooltip-copy">
              <CatalogText html={spell.description} />
            </p>
          </>
        }
      >
        <Image
          unoptimized
          width={38}
          height={38}
          src={`${CDN}/${version}/img/spell/${spell.image.full}`}
          alt=""
        />
        <span>{spell.name}</span>
      </Tooltip>
      {spell.reason && <p className="page-sub">{spell.reason}</p>}
    </div>
  );
}
function ShoppingItems(
  { title, caption, items, version }: {
    title: string;
    caption: string;
    items: PreparationItem[];
    version: string;
  },
) {
  return (
    <section className="section-surface" data-reveal="up">
      <header className="champ-stats-head">
        <h3>{title}</h3>
        <span>{caption}</span>
      </header>
      <div className="section-body shopping-grid">
        {items.length
          ? items.map((item) => (
            <article className="shopping-item" key={item.id}>
              <div className="shopping-item-head">
                <Tooltip
                  label={item.name}
                  content={
                    <>
                      <strong className="tooltip-title">{item.name}</strong>
                      <p className="tooltip-copy">
                        <CatalogText html={item.description} />
                      </p>
                      <p>{item.gold} de oro · parche {version}</p>
                    </>
                  }
                >
                  <Image
                    unoptimized
                    width={44}
                    height={44}
                    src={`${CDN}/${version}/img/item/${item.id}.png`}
                    alt=""
                  />
                </Tooltip>
                <div>
                  <h4>{item.name}</h4>
                  <span className="text-gold">
                    <CountUp
                      value={item.gold}
                      startOnView
                      useGrouping
                      delayMs={0}
                    />{" "}
                    de oro
                  </span>
                </div>
              </div>
              <p>
                <AcademyText text={item.reason} />
              </p>
              {item.components.length > 0 && (
                <details>
                  <summary>Componentes para tu vuelta a base</summary>
                  <ul>
                    {item.components.map((component, index) => (
                      <li key={`${component.id}-${index}`}>
                        <Image
                          unoptimized
                          width={24}
                          height={24}
                          src={`${CDN}/${version}/img/item/${component.id}.png`}
                          alt=""
                        />
                        <span>{component.name}</span>
                        <span>{component.gold} oro</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))
          : (
            <p className="page-sub">
              No hay opciones disponibles con estos datos. Puedes ajustar la
              selección de campeones.
            </p>
          )}
      </div>
    </section>
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
  const stale = guide && JSON.stringify(guide.input) !== JSON.stringify(draft);
  const prepare = useCallback(async (input: DraftInput, scroll = true) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<PreparationGuide>("/preparation/guide", {
        method: "POST",
        body: JSON.stringify(input),
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
      void prepare(input, false);
    }, 600);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
      request.current = null;
    };
  }, [mode, liveSignature, liveId, livePhase, live.state.connected, prepare]);
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
            Conecta el cliente de LoL: tu guía se prepara con los campeones que
            van eligiendo ambos equipos.
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
          <section
            className="preparation-verdict section-body"
            data-reveal="up"
          >
            {mode === "live" && (
              <p className="preparation-live-provenance" role="status">
                {live.state.connected && livePhase === "ChampSelect"
                  ? "Guía de tu selección · actualización automática"
                  : "Última guía generada · la selección ya no está en vivo"}
              </p>
            )}
            <div className="preparation-chosen">
              <Image
                unoptimized
                width={64}
                height={64}
                src={`${CDN}/${guide.version}/img/champion/${guide.chosen.id}.png`}
                alt=""
              />
              <div>
                <span className="teaser-label">
                  {guide.autoSelected
                    ? "Opción propuesta para tu línea"
                    : "Tu campeón seleccionado"}
                </span>
                <h3>{guide.chosen.name}</h3>
              </div>
            </div>
            <p>{guide.method}</p>
            {guide.composition.map((line) => (
              <p className="page-sub" key={line}>{line}</p>
            ))}
            {stale && (
              <p className="preparation-notice" role="status">
                {mode === "live"
                  ? "La selección cambió. Actualizando la guía; las opciones mostradas aún corresponden a la selección anterior."
                  : "Cambiaste la selección. Esta guía corresponde a la anterior; pulsa «Preparar mi guía» para actualizarla."}
              </p>
            )}
            {guide.warnings.map((warning) => (
              <p key={warning} className="preparation-notice">{warning}</p>
            ))}
          </section>
          <section className="section-surface" data-reveal="up">
            <header className="champ-stats-head">
              <h3>Opciones para tu línea</h3>
              <span>Prioriza lo que sabes jugar</span>
            </header>
            <div className="section-body recommendation-grid">
              {guide.recommendations.map(({ champion, reasons }) => (
                <article key={champion.id}>
                  <Image
                    unoptimized
                    width={48}
                    height={48}
                    src={`${CDN}/${guide.version}/img/champion/${champion.id}.png`}
                    alt=""
                  />
                  <h4>{champion.name}</h4>
                  <ul>
                    {reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                  {mode === "live"
                    ? (
                      <p className="page-sub">
                        Elígelo en el cliente para actualizar tu guía.
                      </p>
                    )
                    : (
                      <button
                        type="button"
                        className="rune-link"
                        disabled={loading ||
                          occupied.has(champion.id) &&
                            champion.id !== draft.champion}
                        onClick={() => {
                          const next = { ...draft, champion: champion.id };
                          patch({ champion: champion.id });
                          void prepare(next);
                        }}
                      >
                        Preparar con {champion.name} →
                      </button>
                    )}
                </article>
              ))}
            </div>
          </section>
          <div className="preparation-loadout">
            <section className="section-surface" data-reveal="up">
              <header className="champ-stats-head">
                <h3>Runas como punto de partida</h3>
                <span>Revisa también los fragmentos en el cliente</span>
              </header>
              <div className="section-body">
                <div className="preparation-rune-trees">
                  <div>
                    <h4>
                      {guide.runes.primaryTree?.name ??
                        "Rama principal pendiente"}
                    </h4>
                    <div className="preparation-runes">
                      {guide.runes.primary.map((rune) => (
                        <Rune key={rune.id} rune={rune} />
                      ))}
                    </div>
                    {guide.runes.primary.length < 4 && (
                      <p className="preparation-notice">
                        Completa las runas que cambiaron en este parche.
                      </p>
                    )}
                  </div>
                  <div>
                    <h4>
                      {guide.runes.secondaryTree?.name ??
                        "Rama secundaria pendiente"}
                    </h4>
                    <div className="preparation-runes">
                      {guide.runes.secondary.map((rune) => (
                        <Rune key={rune.id} rune={rune} />
                      ))}
                    </div>
                    {guide.runes.secondary.length < 2 && (
                      <p className="preparation-notice">
                        Revisa las dos elecciones secundarias en el cliente.
                      </p>
                    )}
                  </div>
                </div>
                <p className="page-sub">
                  <AcademyText text={guide.runes.reason} />
                </p>
              </div>
            </section>
            <section className="section-surface" data-reveal="up">
              <header className="champ-stats-head">
                <h3>Hechizos de invocador</h3>
              </header>
              <div className="section-body">
                <div className="preparation-spells">
                  {guide.spells.map((spell) => (
                    <Spell
                      key={spell.key}
                      spell={spell}
                      version={guide.version}
                    />
                  ))}
                </div>
                <details>
                  <summary>Alternativas según tu plan de línea</summary>
                  <p className="page-sub">
                    Compara sus efectos y acuerda la elección con tu equipo.
                    Comprueba el nivel requerido en el cliente.
                  </p>
                  <div className="preparation-spells">
                    {guide.alternatives.map((spell) => (
                      <Spell
                        key={spell.key}
                        spell={spell}
                        version={guide.version}
                      />
                    ))}
                  </div>
                </details>
              </div>
            </section>
          </div>
          <ShoppingItems
            title="Compra inicial"
            caption={guide.input.role === "JUNGLE"
              ? "Elige una mascota"
              : "Respeta tu oro de salida"}
            items={guide.starter}
            version={guide.version}
          />
          <ShoppingItems
            title="Ruta de objetos"
            caption="Una secuencia base que puedes adaptar"
            items={guide.core}
            version={guide.version}
          />
          <ShoppingItems
            title="Botas"
            caption="Elige un solo par"
            items={guide.boots}
            version={guide.version}
          />
          <ShoppingItems
            title="Opciones situacionales"
            caption="Sustituyen compras según la amenaza"
            items={guide.situational}
            version={guide.version}
          />
          <section className="section-surface" data-reveal="up">
            <header className="champ-stats-head">
              <h3>Tu ruta de compras</h3>
              <Link href="/dashboard/academia/compras" className="rune-link">
                Entender la itemización →
              </Link>
            </header>
            <div className="section-body">
              <ol className="academy-steps">
                {guide.purchasePlan.map((step) => (
                  <li key={step}>
                    <AcademyText text={step} />
                  </li>
                ))}
              </ol>
              <p className="page-sub">
                Precios completos y descripciones del parche{" "}
                {guide.version}. Revisa el coste restante de los componentes que
                ya tienes en el cliente.
              </p>
            </div>
          </section>
        </div>
      )}
    </ScrollRevealRoot>
  );
}
