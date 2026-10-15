"use client";
import Image from "next/image";
import { useState } from "react";
import { getBackendUrl } from "../lib/api";
import { apiRequest } from "../lib/useResource";
import { ROLES } from "../lib/player";
import type { DraftSlot, LiveDraftStatus } from "../lib/liveDraft";
import type { ChampionSummary } from "../lib/dataDragon";

const PHASES: Record<string, string> = {
  None: "Cliente abierto",
  Lobby: "En la sala",
  Matchmaking: "Buscando partida",
  ReadyCheck: "Partida encontrada",
  ChampSelect: "Selección de campeones",
  GameStart: "La partida está comenzando",
  InProgress: "Partida en curso",
  Reconnect: "Reconectando a la partida",
  WaitingForStats: "Partida finalizada",
  PreEndOfGame: "Partida finalizada",
  EndOfGame: "Partida finalizada",
  ClientClosed: "Abre League of Legends",
  ClientUnavailable: "No se pudo leer el cliente",
  Unsupported: "Esperando una selección compatible",
};
export function LiveDraftPanel(
  { state, error, reload, champions, version, role, onRoleChange, reason }: {
    state: LiveDraftStatus;
    error: string | null;
    reload: () => void;
    champions: (ChampionSummary & { key?: string })[];
    version: string;
    role: string;
    onRoleChange: (value: string) => void;
    reason: string;
  },
) {
  const [pairing, setPairing] = useState<
    { token: string; expiresAt: string } | null
  >(null);
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState<string | null>(null),
    [copied, setCopied] = useState(false);
  const snapshot = state.snapshot;
  const active = state.connected && snapshot?.phase === "ChampSelect";
  const status = !state.paired
    ? "Conecta tu cliente"
    : !state.connected
    ? "Esperando al acompañante"
    : PHASES[snapshot?.phase ?? ""] ?? "Esperando selección";
  async function connect() {
    setBusy(true);
    setActionError(null);
    setCopied(false);
    try {
      setPairing(
        await apiRequest("/preparation/live/connect", { method: "POST" }),
      );
      reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "No pudimos crear la conexión.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    setActionError(null);
    try {
      await apiRequest("/preparation/live/disconnect", { method: "POST" });
      setPairing(null);
      reload();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "No pudimos desconectar el acompañante.",
      );
    } finally {
      setBusy(false);
    }
  }
  function slot(
    entry: DraftSlot | undefined,
    index: number,
    opponent: boolean,
  ) {
    const isMe = !opponent && entry?.cellId === snapshot?.localCellId;
    const id = entry?.championId || (!opponent ? entry?.intentId : 0);
    const champion = id
      ? champions.find((candidate) => Number(candidate.key) === id)
      : null;
    return (
      <li
        className={`live-draft-slot${isMe ? " is-you" : ""}`}
        key={entry?.cellId ?? `empty-${index}`}
      >
        {champion
          ? (
            <Image
              unoptimized
              width={44}
              height={44}
              src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.id}.png`}
              alt=""
            />
          )
          : (
            <span className="live-draft-placeholder" aria-hidden="true">
              ?
            </span>
          )}
        <div>
          <strong>
            {champion?.name ??
              (id ? "Campeón fuera del catálogo" : "Sin elegir")}
          </strong>
          <span>
            {isMe
              ? "Tú"
              : opponent
              ? `Rival ${index + 1}`
              : `Aliado ${index + 1}`}
            {entry?.role
              ? ` · ${
                ROLES.find((item) => item.id === entry.role)?.name ?? entry.role
              }`
              : ""}
          </span>
        </div>
        <span
          className={`live-pick-status${
            entry?.lockedIn && id ? " locked" : ""
          }`}
        >
          {id ? entry?.lockedIn ? "Confirmado" : "Intención" : "Pendiente"}
        </span>
      </li>
    );
  }
  return (
    <section
      className="section-surface live-draft-panel"
      data-reveal="up"
      aria-labelledby="live-draft-title"
    >
      <header className="champ-stats-head">
        <div>
          <h3 id="live-draft-title">Tu selección en vivo</h3>
          <p className="live-draft-status" role="status">
            <i className={active ? "is-active" : ""} />
            {status}
          </p>
        </div>
        <span>Lectura automática del cliente</span>
      </header>
      <div className="section-body">
        {(error || actionError) && (
          <p className="preparation-notice" role="alert">
            {actionError || error}
          </p>
        )}
        <details className="live-connection-setup" open={!state.paired}>
          <summary>
            {state.paired
              ? "Administrar conexión con Windows"
              : "Conectar con League of Legends en Windows"}
          </summary>
          <ol>
            <li>
              Abre LoL e instala Node.js 22 o posterior en ese equipo, si aún no
              lo tienes.
            </li>
            <li>
              <a
                className="rune-link"
                href={`${getBackendUrl()}/preparation/live/companion`}
                download="coach-companion.mjs"
              >
                Descargar acompañante →
              </a>{" "}
              Guarda el archivo y ejecuta <code>node coach-companion.mjs</code>
              {" "}
              desde esa carpeta.
            </li>
            <li>
              En el acompañante, introduce esta URL de la API:{" "}
              <code className="live-api-url">{getBackendUrl()}</code>
            </li>
            <li>
              Genera un código y pégalo en el acompañante. Luego déjalo abierto
              mientras juegas.
            </li>
          </ol>
          <div className="live-connection-actions">
            <button
              className="rune-btn btn-sm"
              type="button"
              disabled={busy}
              onClick={connect}
            >
              {busy
                ? "Actualizando…"
                : state.paired
                ? "Generar otro código"
                : "Generar código de conexión"}
            </button>
            {state.paired && (
              <button
                className="btn-outline"
                type="button"
                disabled={busy}
                onClick={disconnect}
              >
                Desconectar
              </button>
            )}
          </div>
          {pairing && (
            <div className="live-pairing-code">
              <label className="field-label">
                Código privado · válido durante 12 horas<input
                  className="rune-field"
                  type="password"
                  readOnly
                  value={pairing.token}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button
                className="btn-outline"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pairing.token);
                    setCopied(true);
                  } catch {
                    setActionError(
                      "No pudimos copiarlo. Selecciona el código y cópialo manualmente.",
                    );
                  }
                }}
              >
                {copied ? "Copiado ✓" : "Copiar código"}
              </button>
            </div>
          )}
          <p className="page-sub">
            La conexión solo lee la selección. No modifica tus campeones ni tus
            runas. Puedes revocarla aquí; generar otro código reemplaza el
            anterior.
          </p>
        </details>
        {active && snapshot
          ? (
            <>
              <div className="live-draft-teams">
                <section>
                  <h4>
                    Tu equipo <span>Selecciones e intenciones visibles</span>
                  </h4>
                  <ul>
                    {Array.from(
                      { length: 5 },
                      (_, index) => slot(snapshot.myTeam[index], index, false),
                    )}
                  </ul>
                </section>
                <section>
                  <h4>
                    Equipo rival <span>Solo elecciones confirmadas</span>
                  </h4>
                  <ul>
                    {Array.from(
                      { length: 5 },
                      (_, index) =>
                        slot(snapshot.theirTeam[index], index, true),
                    )}
                  </ul>
                </section>
              </div>
              {!!snapshot.bans.length && (
                <div className="live-draft-bans">
                  <span>Bloqueados</span>
                  {snapshot.bans.map((id) => {
                    const champion = champions.find((item) =>
                      Number(item.key) === id
                    );
                    return (
                      <span key={id}>
                        {champion
                          ? (
                            <Image
                              unoptimized
                              width={28}
                              height={28}
                              src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.id}.png`}
                              alt={champion.name}
                              title={champion.name}
                            />
                          )
                          : "?"}
                      </span>
                    );
                  })}
                </div>
              )}
              {!snapshot.myTeam.find((entry) =>
                entry.cellId === snapshot.localCellId
              )?.role && (
                <label className="field-label live-role-choice">
                  Tu línea (el cliente no la asignó)<select
                    className="rune-field"
                    value={role}
                    onChange={(event) => onRoleChange(event.target.value)}
                  >
                    <option value="">Elige tu línea</option>
                    {ROLES.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <p className="live-draft-note" role="status">{reason}</p>
              {![400, 420, 440].includes(snapshot.queueId ?? -1) && (
                <p className="page-sub">
                  En esta cola solo se utiliza tu equipo; no se muestran
                  elecciones rivales ocultas.
                </p>
              )}
              {snapshot.availableChampionIds === null && (
                <p className="page-sub">
                  El cliente no informó los campeones disponibles. Comprueba que
                  puedes elegir las opciones propuestas.
                </p>
              )}
            </>
          )
          : (
            <div className="live-draft-waiting">
              <span aria-hidden="true">◇</span>
              <h4>{status}</h4>
              <p>
                {state.connected
                  ? snapshot?.phase === "InProgress" ||
                      snapshot?.phase === "GameStart"
                    ? "La selección terminó. Puedes consultar la última guía generada abajo."
                    : "Al entrar a selección, tus equipos aparecerán aquí y la guía se preparará automáticamente."
                  : state.paired
                  ? "Mantén abierto el acompañante en Windows. La página se actualizará al recibir la conexión."
                  : "Conecta el acompañante una vez para recibir los campeones del cliente durante el draft."}
              </p>
            </div>
          )}
      </div>
    </section>
  );
}
