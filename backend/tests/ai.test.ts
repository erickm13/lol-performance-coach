import "./test_setup.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { db } from "../src/db/client.ts";
import { users } from "../src/db/schema.ts";
import { signSessionToken } from "../src/auth/jwt.ts";
import { app } from "../src/app.ts";

async function createSessionCookie(): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  const token = await signSessionToken(user.id);
  return `session=${token}`;
}

Deno.test("POST /ai/chat rechaza a un usuario no autenticado", async () => {
  const res = await app.request("/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context: "general" }),
  });

  assertEquals(res.status, 401);
});

Deno.test("POST /ai/chat devuelve el saludo genérico por defecto", async () => {
  const cookie = await createSessionCookie();

  const res = await app.request("/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({}),
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.messages.length, 1);
  assertEquals(body.messages[0].role, "bot");
});

/**
 * Corre `fn` garantizando que GROQ_API_KEY NO esté seteada, para ejercitar el
 * mensaje de fallback sin tocar la red real. `Deno.env` es global al proceso
 * de test y compartido con los demás archivos.
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

Deno.test("POST /ai/chat cae al mensaje de fallback si Groq no está disponible (contexto de partida)", async () => {
  const cookie = await createSessionCookie();

  const res = await withoutGroqKey(() =>
    app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        context: "match",
        match: { champion: "Ahri", win: true, kills: 5, deaths: 2, assists: 8 },
      }),
    })
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.messages.length, 1);
  assertEquals(body.messages[0].role, "bot");
});

Deno.test("POST /ai/chat cae al mensaje de fallback si Groq no está disponible (pregunta de seguimiento sobre una partida)", async () => {
  const cookie = await createSessionCookie();

  const res = await withoutGroqKey(() =>
    app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        context: "match",
        message: "¿Por qué morí tanto?",
        match: {
          summonerName: "TP Salchipapa",
          champion: "Ahri",
          win: false,
          kills: 2,
          deaths: 9,
          assists: 3,
        },
      }),
    })
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.messages.length, 1);
  assertEquals(body.messages[0].role, "bot");
});

Deno.test("POST /ai/chat cae al mensaje de fallback si Groq no está disponible (mensaje libre)", async () => {
  const cookie = await createSessionCookie();

  const res = await withoutGroqKey(() =>
    app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ context: "general", message: "¿Cómo mejoro mi visión?" }),
    })
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.messages.length, 1);
  assertEquals(body.messages[0].role, "bot");
});
