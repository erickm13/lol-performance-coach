import { Context, Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { verifySessionToken } from "../auth/jwt.ts";
import {
  AlreadyLinkedError,
  getStoredRiotAccount,
  linkRiotAccount,
  NotLinkedError,
  PuuidTakenError,
  syncRiotAccount,
} from "../riot/ingest.ts";
import {
  RiotAuthError,
  RiotNotFoundError,
  RiotRateLimitError,
} from "../riot/client.ts";

const SESSION_COOKIE = "session";

async function requireUserId(c: Context): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  return token ? await verifySessionToken(token) : null;
}

function mapRiotError(err: unknown): { status: 404 | 409 | 502; message: string } {
  if (err instanceof RiotNotFoundError) {
    return { status: 404, message: "No encontramos esa cuenta de Riot" };
  }
  if (err instanceof PuuidTakenError) {
    return { status: 409, message: err.message };
  }
  if (err instanceof RiotAuthError) {
    return {
      status: 502,
      message: "No pudimos conectar con Riot. La clave de API puede haber expirado.",
    };
  }
  if (err instanceof RiotRateLimitError) {
    return { status: 502, message: "Riot limitó las solicitudes, intentá de nuevo en un momento" };
  }
  console.error("Error inesperado en ruta de Riot:", err);
  return { status: 502, message: "No pudimos conectar con Riot" };
}

export const riotRoutes = new Hono();

riotRoutes.post("/link", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const { gameName, tagLine } = (await c.req.json()) as {
    gameName?: string;
    tagLine?: string;
  };
  if (typeof gameName !== "string" || !gameName || typeof tagLine !== "string" || !tagLine) {
    return c.json({ error: "gameName y tagLine son requeridos" }, 400);
  }

  try {
    const result = await linkRiotAccount(userId, gameName, tagLine);
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof AlreadyLinkedError) {
      return c.json({ error: err.message }, 409);
    }
    const { status, message } = mapRiotError(err);
    return c.json({ error: message }, status);
  }
});

riotRoutes.post("/sync", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  try {
    const result = await syncRiotAccount(userId);
    return c.json(result);
  } catch (err) {
    if (err instanceof NotLinkedError) {
      return c.json({ error: err.message }, 404);
    }
    const { status, message } = mapRiotError(err);
    return c.json({ error: message }, status);
  }
});

riotRoutes.get("/account", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const stored = await getStoredRiotAccount(userId);
  if (!stored) return c.json({ account: null });

  return c.json(stored);
});
