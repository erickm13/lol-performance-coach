// Windows companion, Node.js 22+. No packages, local web server or game writes.
import process from "node:process";
import { request } from "node:https";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createInterface } from "node:readline/promises";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";

const run = promisify(execFile);
const roles = {
  top: "TOP",
  jungle: "JUNGLE",
  middle: "MIDDLE",
  bottom: "BOTTOM",
  utility: "UTILITY",
  support: "UTILITY",
};
const positive = (value) =>
  Number.isSafeInteger(value) && value > 0 && value < 100000 ? value : 0;
let credentials = null;
async function discover() {
  if (credentials) return credentials;
  // Read only the LoL UX process arguments; do not print or upload them.
  const script =
    "@(Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" -ErrorAction Stop | Select-Object -ExpandProperty CommandLine) | ConvertTo-Json -Compress";
  const { stdout } = await run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ], { windowsHide: true, timeout: 8000, maxBuffer: 256000 });
  const result = stdout.trim() ? JSON.parse(stdout) : [];
  for (const command of Array.isArray(result) ? result : [result]) {
    if (typeof command !== "string") continue;
    const port = /(?:^|[\s"])--app-port=(\d+)/.exec(command)?.[1];
    const token = /(?:^|[\s"])--remoting-auth-token=([^\s"]+)/.exec(command)
      ?.[1];
    if (port && token && Number(port) > 0 && Number(port) <= 65535) {
      credentials = { port: Number(port), token };
      return credentials;
    }
  }
  return null;
}
function lcu(auth, path) {
  const allowed = [
    "/lol-gameflow/v1/gameflow-phase",
    "/lol-gameflow/v1/session",
    "/lol-champ-select/v1/session",
    "/lol-champ-select/v1/pickable-champion-ids",
  ];
  if (!allowed.includes(path)) throw new Error("Lectura local no permitida.");
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: "127.0.0.1",
      port: auth.port,
      path,
      method: "GET",
      headers: {
        Authorization: `Basic ${
          Buffer.from(`riot:${auth.token}`).toString("base64")
        }`,
      },
      // The client uses a self-signed cert. Exception confined to loopback LCU.
      rejectUnauthorized: false,
      agent: false,
    }, (response) => {
      let size = 0, text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        size += Buffer.byteLength(chunk);
        if (size > 1000000) {
          response.destroy();
          reject(new Error("Respuesta local demasiado grande."));
        } else text += chunk;
      });
      response.on("error", reject);
      response.on("end", () => {
        if (response.statusCode === 404) {
          resolve(null);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error("El cliente no permite la lectura."));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch {
          reject(new Error("Respuesta local incompatible."));
        }
      });
    });
    req.setTimeout(
      3500,
      () => req.destroy(new Error("El cliente no responde.")),
    );
    req.on("error", reject);
    req.end();
  });
}
let draftId = null;
let previousPhase = null;
const empty = (phase) => ({ version: 1, phase });
async function snapshot() {
  let auth;
  try {
    auth = await discover();
  } catch {
    return empty("ClientUnavailable");
  }
  if (!auth) return empty("ClientClosed");
  try {
    const phase = await lcu(auth, "/lol-gameflow/v1/gameflow-phase");
    const known = [
      "None",
      "Lobby",
      "Matchmaking",
      "ReadyCheck",
      "GameStart",
      "InProgress",
      "WaitingForStats",
      "PreEndOfGame",
      "EndOfGame",
      "Reconnect",
    ];
    if (phase !== "ChampSelect") {
      previousPhase = phase;
      draftId = null;
      return empty(known.includes(phase) ? phase : "Unsupported");
    }
    const session = await lcu(auth, "/lol-champ-select/v1/session");
    if (
      !session || session.isSpectating || session.allowDuplicatePicks ||
      !Array.isArray(session.myTeam) ||
      !session.myTeam.some((slot) => slot.cellId === session.localPlayerCellId)
    ) return empty("Unsupported");
    if (previousPhase !== "ChampSelect" || !draftId) draftId = randomUUID();
    previousPhase = "ChampSelect";
    const gameflow = await lcu(auth, "/lol-gameflow/v1/session");
    let available = null;
    try {
      const ids = await lcu(auth, "/lol-champ-select/v1/pickable-champion-ids");
      if (Array.isArray(ids)) {
        available = [...new Set(ids.map(positive).filter(Boolean))].slice(
          0,
          1000,
        );
      }
    } catch { /* Selection still works; availability is explicitly unknown. */ }
    const actions = Array.isArray(session.actions)
      ? session.actions.flat()
      : [];
    const complete = (cellId) =>
      actions.some((action) =>
        action.type === "pick" && action.actorCellId === cellId &&
        action.completed === true
      );
    const team = (entries, opponents = false) =>
      (Array.isArray(entries) ? entries : []).slice(0, 5).map((slot) => {
        const lockedIn = complete(slot.cellId) ||
          (!opponents && session.timer?.phase === "FINALIZATION");
        return {
          cellId: slot.cellId,
          // Opponent hovers are never sent, even if some client version exposes them.
          championId: opponents && !lockedIn ? 0 : positive(slot.championId),
          intentId: opponents ? 0 : positive(slot.championPickIntent),
          role: opponents
            ? null
            : roles[String(slot.assignedPosition).toLowerCase()] ?? null,
          lockedIn,
        };
      });
    return {
      version: 1,
      phase: "ChampSelect",
      draftId,
      localCellId: session.localPlayerCellId,
      mapId: positive(
        gameflow?.gameData?.queue?.mapId ?? gameflow?.map?.id ??
          gameflow?.gameData?.map?.id,
      ) || null,
      queueId: positive(gameflow?.gameData?.queue?.id) || null,
      gameMode: String(
        gameflow?.gameData?.queue?.gameMode ?? gameflow?.map?.gameMode ?? "",
      ),
      myTeam: team(session.myTeam),
      // Only queues with a publicly visible enemy draft. No blind-pick reveal.
      theirTeam: [400, 420, 440].includes(gameflow?.gameData?.queue?.id)
        ? team(session.theirTeam, true)
        : [],
      bans: [
        ...new Set(
          [
            ...(session.bans?.myTeamBans ?? []),
            ...(session.bans?.theirTeamBans ?? []),
          ].map(positive).filter(Boolean),
        ),
      ],
      availableChampionIds: available,
    };
  } catch {
    credentials = null;
    previousPhase = null;
    draftId = null;
    return empty("ClientUnavailable");
  }
}
async function main() {
  if (process.platform !== "win32") {
    throw new Error(
      "Este acompañante está preparado para Windows, donde se ejecuta tu cliente de LoL.",
    );
  }
  if (Number(process.versions.node.split(".")[0]) < 22) {
    throw new Error(
      "Instala Node.js 22 o posterior para ejecutar el acompañante.",
    );
  }
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log(
    "LoL Performance Coach · Conexión de selección de campeones\nLee la selección visible. No elige campeones ni cambia runas o archivos del juego.",
  );
  let base, token;
  try {
    base = new URL(
      (await input.question("URL de la API mostrada en Preparar partida: "))
        .trim(),
    );
    if (
      base.username || base.password || base.search || base.hash ||
      (base.protocol !== "https:" &&
        !(base.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(base.hostname)))
    ) {
      throw new Error(
        "Usa la URL HTTPS de la API; HTTP solo se admite en localhost.",
      );
    }
    token = (await input.question("Código de conexión generado en la web: "))
      .trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(token)) {
      throw new Error(
        "El código no tiene el formato esperado. Genera otro desde Preparar partida.",
      );
    }
  } finally {
    input.close();
  }
  const endpoint = new URL(
    `${base.pathname.replace(/\/$/, "")}/preparation/live/snapshot`,
    base.origin,
  );
  let previous = "", lastSent = 0, lastStatus = "";
  const announce = (text) => {
    if (text !== lastStatus) {
      console.log(text);
      lastStatus = text;
    }
  };
  while (true) {
    const data = await snapshot();
    const serialized = JSON.stringify(data);
    if (serialized !== previous || Date.now() - lastSent >= 5000) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          redirect: "error",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: serialized,
          signal: AbortSignal.timeout(8000),
        });
        await response.body?.cancel();
        if (response.status === 401) {
          throw new Error(
            "La conexión expiró o fue revocada. Genera otro código y vuelve a ejecutar el acompañante.",
          );
        }
        if (response.status === 400 || response.status === 413) {
          throw new Error(
            "Actualiza el acompañante desde la web: la selección no tiene el formato esperado.",
          );
        }
        if (!response.ok) {
          announce(
            "La plataforma no está disponible. Reintentando la conexión…",
          );
          await delay(6000);
          continue;
        }
        previous = serialized;
        lastSent = Date.now();
        announce(
          data.phase === "ChampSelect"
            ? "Selección conectada. Tu guía se actualiza en la web."
            : data.phase === "ClientClosed"
            ? "Conexión lista. Abre League of Legends para continuar."
            : data.phase === "ClientUnavailable"
            ? "No se pudo leer el cliente. Abre LoL y revisa que ambos programas se ejecuten con el mismo usuario de Windows."
            : `Cliente: ${data.phase}. Esperando selección de campeones…`,
        );
      } catch (error) {
        if (error instanceof TypeError || error?.name === "TimeoutError") {
          announce("No se pudo conectar con la plataforma. Reintentando…");
          await delay(6000);
          continue;
        }
        throw error;
      }
    }
    await delay(credentials ? 1500 : 4000);
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error && !(error instanceof TypeError)
      ? error.message
      : "No se pudo iniciar el acompañante. Revisa la URL de la API.",
  );
  process.exitCode = 1;
});
