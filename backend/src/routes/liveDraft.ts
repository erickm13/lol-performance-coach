import { Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { and, eq, gt } from "npm:drizzle-orm@^0.36.0";
import { verifySessionToken } from "../auth/jwt.ts";
import { db } from "../db/client.ts";
import { liveDraftConnections, riotAccounts } from "../db/schema.ts";
import { getCachedTeammateSoloTier } from "../riot/ingest.ts";
import {
  bridgeTokenHash,
  type LiveDraftSnapshot,
  parseLiveDraft,
} from "../preparation/liveDraft.ts";

export const liveDraftRoutes = new Hono<{ Variables: { userId: string } }>();
liveDraftRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});
// Source contains no credentials. The browser downloads it; Node runs it locally.
liveDraftRoutes.get("/companion", async (c) => {
  c.header("Content-Type", "text/javascript; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="coach-companion.mjs"');
  return c.body(
    await Deno.readTextFile(
      new URL("../preparation/companion.mjs", import.meta.url),
    ),
  );
});
// Device authentication is separate from the platform session cookie.
liveDraftRoutes.post("/snapshot", async (c) => {
  const bearer = /^Bearer ([a-f0-9]{64})$/i.exec(
    c.req.header("Authorization") ?? "",
  )?.[1];
  if (!bearer) {
    return c.json(
      { error: "Vuelve a conectar el acompañante desde la web." },
      401,
    );
  }
  const tokenHash = await bridgeTokenHash(bearer);
  const text = await c.req.text();
  if (text.length > 32768) {
    return c.json({ error: "Selección demasiado grande." }, 413);
  }
  let snapshot: LiveDraftSnapshot;
  let accountFingerprint: string | null = null;
  let teammatePuuids: string[] = [];
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    snapshot = parseLiveDraft(body);
    teammatePuuids = Array.isArray(body.teammatePuuids)
      ? [...new Set(body.teammatePuuids.filter((puuid): puuid is string =>
        typeof puuid === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(puuid)
      ))].slice(0, 4)
      : [];
    accountFingerprint = typeof body.accountFingerprint === "string" &&
        /^[a-f0-9]{64}$/i.test(body.accountFingerprint)
      ? body.accountFingerprint.toLowerCase()
      : null;
  } catch {
    return c.json({
      error:
        "La selección recibida no es compatible. Actualiza el acompañante.",
    }, 400);
  }
  const conditions = and(
    eq(liveDraftConnections.tokenHash, tokenHash),
    gt(liveDraftConnections.expiresAt, new Date()),
  );
  const [connection] = await db.select({ userId: liveDraftConnections.userId })
    .from(liveDraftConnections).where(conditions).limit(1);
  if (!connection) return c.json({
    error:
      "La conexión expiró o fue revocada. Genera un nuevo código en la web.",
  }, 401);

  const [account] = await db.select({ puuid: riotAccounts.puuid }).from(
    riotAccounts,
  ).where(eq(riotAccounts.userId, connection.userId)).limit(1);
  const accountStatus = !accountFingerprint
    ? "unverified"
    : !account
    ? "unlinked"
    : accountFingerprint === await bridgeTokenHash(account.puuid)
    ? "match"
    : "mismatch";
  const teammateTiers = accountStatus === "match" && account
    ? (await Promise.all(teammatePuuids
      .filter((puuid) => puuid !== account.puuid)
      .map((puuid) => getCachedTeammateSoloTier(puuid)))).filter(
        (tier): tier is string => !!tier,
      )
    : [];
  const verifiedSnapshot = { ...snapshot, teammateTiers, accountStatus };
  await db.update(liveDraftConnections).set({
    snapshot: verifiedSnapshot,
    receivedAt: new Date(),
  }).where(conditions);
  return c.json({ received: true });
});
liveDraftRoutes.use("*", async (c, next) => {
  const token = getCookie(c, "session");
  const id = token ? await verifySessionToken(token) : null;
  if (!id) return c.json({ error: "No autenticado" }, 401);
  c.set("userId", id);
  await next();
});
liveDraftRoutes.get("/status", async (c) => {
  const [row] = await db.select({
    expiresAt: liveDraftConnections.expiresAt,
    receivedAt: liveDraftConnections.receivedAt,
    snapshot: liveDraftConnections.snapshot,
  }).from(liveDraftConnections).where(
    eq(liveDraftConnections.userId, c.get("userId")),
  ).limit(1);
  const paired = !!row && row.expiresAt.getTime() > Date.now();
  const connected = paired && !!row.receivedAt &&
    Date.now() - row.receivedAt.getTime() < 20000;
  return c.json({
    paired,
    connected,
    expiresAt: paired ? row.expiresAt : null,
    receivedAt: paired ? row.receivedAt : null,
    snapshot: paired ? row.snapshot : null,
  });
});
liveDraftRoutes.post("/connect", async (c) => {
  const token = Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const tokenHash = await bridgeTokenHash(token),
    expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const userId = c.get("userId");
  await db.insert(liveDraftConnections).values({ userId, tokenHash, expiresAt })
    .onConflictDoUpdate({
      target: liveDraftConnections.userId,
      set: { tokenHash, expiresAt, receivedAt: null, snapshot: null },
    });
  return c.json({ token, expiresAt });
});
liveDraftRoutes.post("/disconnect", async (c) => {
  await db.delete(liveDraftConnections).where(
    eq(liveDraftConnections.userId, c.get("userId")),
  );
  return c.json({ disconnected: true });
});
