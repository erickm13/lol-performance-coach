import "./test_setup.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { db } from "../src/db/client.ts";
import { riotAccounts, users, weaknesses } from "../src/db/schema.ts";
import { signSessionToken } from "../src/auth/jwt.ts";
import { app } from "../src/app.ts";

/**
 * Corre `fn` garantizando que GROQ_API_KEY NO esté seteada, para que la
 * generación de plan caiga al modo solo-reglas sin tocar la red. `Deno.env` es
 * global al proceso de test y compartido con los demás archivos, así que no
 * alcanza con asumir que no está: hay que sacarla y restaurarla.
 */
async function withoutGroqKey<T>(fn: () => T | Promise<T>): Promise<T> {
  const original = Deno.env.get("GROQ_API_KEY");
  Deno.env.delete("GROQ_API_KEY");
  try {
    return await fn();
  } finally {
    if (original !== undefined) Deno.env.set("GROQ_API_KEY", original);
  }
}

async function createUserWithRiotAccount(): Promise<{ cookie: string; riotAccountId: string }> {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  const [riotAccount] = await db
    .insert(riotAccounts)
    .values({
      userId: user.id,
      puuid: crypto.randomUUID(),
      summonerName: "Tester",
      tagLine: "0000",
      region: "LAN",
    })
    .returning();
  const token = await signSessionToken(user.id);
  return { cookie: `session=${token}`, riotAccountId: riotAccount.id };
}

Deno.test("GET /riot/weaknesses rechaza a un usuario no autenticado", async () => {
  const res = await app.request("/riot/weaknesses");
  assertEquals(res.status, 401);
});

Deno.test("GET /riot/weaknesses devuelve lista vacía sin cuenta vinculada", async () => {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  const token = await signSessionToken(user.id);

  const res = await app.request("/riot/weaknesses", {
    headers: { Cookie: `session=${token}` },
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.weaknesses, []);
});

Deno.test("GET /riot/weaknesses devuelve las debilidades guardadas", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  await db.insert(weaknesses).values({
    riotAccountId,
    category: "farming",
    description: "Descripción de prueba",
    severity: "high",
    evidence: [],
  });

  const res = await app.request("/riot/weaknesses", { headers: { Cookie: cookie } });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.weaknesses.length, 1);
  assertEquals(body.weaknesses[0].category, "farming");
});

Deno.test("GET /riot/weaknesses ordena por severidad, la más urgente primero", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  await db.insert(weaknesses).values([
    {
      riotAccountId,
      category: "farming",
      description: "Baja severidad",
      severity: "low",
      evidence: [],
    },
    {
      riotAccountId,
      category: "consistency",
      description: "Alta severidad",
      severity: "high",
      evidence: [],
    },
    {
      riotAccountId,
      category: "vision",
      description: "Severidad media",
      severity: "medium",
      evidence: [],
    },
  ]);

  const res = await app.request("/riot/weaknesses", { headers: { Cookie: cookie } });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.weaknesses.length, 3);
  assertEquals(
    body.weaknesses.map((w: { severity: string }) => w.severity),
    ["high", "medium", "low"],
  );
  assertEquals(body.weaknesses[0].category, "consistency");
});

Deno.test("GET /riot/training-plan devuelve plan null sin plan activo", async () => {
  const { cookie } = await createUserWithRiotAccount();
  const res = await app.request("/riot/training-plan", { headers: { Cookie: cookie } });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.plan, null);
});

Deno.test("POST /riot/training-plan sin cuenta de Riot vinculada devuelve 404", async () => {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  const token = await signSessionToken(user.id);

  const res = await app.request("/riot/training-plan", {
    method: "POST",
    headers: { Cookie: `session=${token}` },
  });
  assertEquals(res.status, 404);
});

Deno.test("POST /riot/training-plan genera un plan a partir de las debilidades guardadas", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  await db.insert(weaknesses).values({
    riotAccountId,
    category: "vision",
    description: "Descripción de prueba",
    severity: "low",
    evidence: [],
  });

  // `withoutGroqKey` saca GROQ_API_KEY del entorno, así que la generación
  // cae al fallback solo-reglas sin hacer ninguna llamada de red a Groq.
  const res = await withoutGroqKey(() =>
    app.request("/riot/training-plan", {
      method: "POST",
      headers: { Cookie: cookie },
    })
  );
  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body.plan.generatedBy, "rules");
  assertEquals(body.items.length > 0, true);
});

Deno.test("POST /riot/training-plan/items/:itemId/progress guarda el progreso", async () => {
  const { cookie, riotAccountId } = await createUserWithRiotAccount();
  await db.insert(weaknesses).values({
    riotAccountId,
    category: "vision",
    description: "Descripción de prueba",
    severity: "low",
    evidence: [],
  });
  const planRes = await withoutGroqKey(() =>
    app.request("/riot/training-plan", {
      method: "POST",
      headers: { Cookie: cookie },
    })
  );
  const { items } = await planRes.json();

  const res = await app.request(
    `/riot/training-plan/items/${items[0].id}/progress`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ selfRating: 5, note: "Listo" }),
    },
  );
  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body.selfRating, 5);
});

Deno.test("POST /riot/training-plan/items/:itemId/progress devuelve 404 con un itemId mal formado", async () => {
  const { cookie } = await createUserWithRiotAccount();

  // "no-es-un-uuid" no es un UUID: antes llegaba a Postgres como cast a uuid,
  // explotaba y salía un 500 en vez del 404 del chequeo de pertenencia.
  const res = await app.request(
    "/riot/training-plan/items/no-es-un-uuid/progress",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ selfRating: 5 }),
    },
  );

  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.error, "Ítem no encontrado");
});

Deno.test("POST /riot/training-plan/items/:itemId/progress devuelve 404 con un UUID inexistente", async () => {
  const { cookie } = await createUserWithRiotAccount();

  const res = await app.request(
    `/riot/training-plan/items/${crypto.randomUUID()}/progress`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ selfRating: 5 }),
    },
  );

  assertEquals(res.status, 404);
});

Deno.test("GET /riot/training-plan rechaza a un usuario no autenticado", async () => {
  const res = await app.request("/riot/training-plan");
  assertEquals(res.status, 401);
});

Deno.test("POST /riot/training-plan rechaza a un usuario no autenticado", async () => {
  const res = await app.request("/riot/training-plan", {
    method: "POST",
  });
  assertEquals(res.status, 401);
});

Deno.test("POST /riot/training-plan/items/:itemId/progress rechaza a un usuario no autenticado", async () => {
  const res = await app.request("/riot/training-plan/items/fake-item-id/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selfRating: 5 }),
  });
  assertEquals(res.status, 401);
});

Deno.test("POST /riot/training-plan/items/:itemId/progress rechaza acceso cruzado entre cuentas", async () => {
  // User A creates a training plan
  const { cookie: cookieA, riotAccountId: accountIdA } = await createUserWithRiotAccount();
  await db.insert(weaknesses).values({
    riotAccountId: accountIdA,
    category: "farming",
    description: "Debilidad de prueba",
    severity: "high",
    evidence: [],
  });
  const planResA = await withoutGroqKey(() =>
    app.request("/riot/training-plan", {
      method: "POST",
      headers: { Cookie: cookieA },
    })
  );
  const { items: itemsA } = await planResA.json();
  const itemIdA = itemsA[0].id;

  // User B tries to access User A's item
  const { cookie: cookieB } = await createUserWithRiotAccount();
  const res = await app.request(
    `/riot/training-plan/items/${itemIdA}/progress`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({ selfRating: 5, note: "Hacked" }),
    },
  );

  // Should be rejected with 404
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.error, "Ítem no encontrado");
});
