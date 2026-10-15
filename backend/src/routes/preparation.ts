import { Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { verifySessionToken } from "../auth/jwt.ts";
import { preparationCatalog } from "../preparation/catalog.ts";
import {
  buildPreparation,
  parseDraft,
  PreparationValidationError,
} from "../preparation/guide.ts";
import { readPlayerProfile } from "../player/profile.ts";
import { db } from "../db/client.ts";
import { riotAccounts } from "../db/schema.ts";
import { eq } from "npm:drizzle-orm@^0.36.0";
import { getChampionStats } from "../riot/ingest.ts";
export const preparationRoutes = new Hono<{ Variables: { userId: string } }>();
preparationRoutes.use("*", async (c, next) => {
  const token = getCookie(c, "session");
  const id = token ? await verifySessionToken(token) : null;
  if (!id) return c.json({ error: "No autenticado" }, 401);
  c.set("userId", id);
  await next();
});
preparationRoutes.get("/catalog", async (c) => {
  try {
    const data = await preparationCatalog();
    return c.json({ version: data.version, champions: data.champions });
  } catch {
    return c.json({
      error: "No pudimos cargar el catálogo de Riot. Reintenta en un momento.",
    }, 503);
  }
});
preparationRoutes.post("/guide", async (c) => {
  const body = await c.req.json().catch(() => null);
  let catalog;
  try {
    catalog = await preparationCatalog();
  } catch {
    return c.json({
      error:
        "El catálogo de Riot no está disponible. Tu selección se conserva; vuelve a intentarlo.",
    }, 503);
  }
  try {
    const input = parseDraft(body, catalog),
      profile = await readPlayerProfile(c.get("userId"));
    const [account] = await db.select({ id: riotAccounts.id }).from(
      riotAccounts,
    ).where(eq(riotAccounts.userId, c.get("userId"))).limit(1);
    const observed = account ? await getChampionStats(account.id) : [];
    return c.json(
      buildPreparation(
        input,
        catalog,
        profile?.champions ?? [],
        profile?.experience ?? null,
        observed,
      ),
    );
  } catch (error) {
    if (error instanceof PreparationValidationError) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});
