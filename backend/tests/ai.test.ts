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

/** Desactiva ambos proveedores durante la prueba, sin llamadas a la red. */
async function withoutLlmKeys<T>(fn: () => T | Promise<T>): Promise<T> {
  const variables = ["GROQ_API_KEY", "GEMINI_API_KEY"];
  const originals = variables.map((name) => Deno.env.get(name));
  variables.forEach((name) => Deno.env.delete(name));
  try {
    return await fn();
  } finally {
    variables.forEach((name, i) => {
      if (originals[i] === undefined) Deno.env.delete(name);
      else Deno.env.set(name, originals[i]!);
    });
  }
}

Deno.test("POST /ai/chat cae al error de configuración recuperable si no hay proveedores disponibles (contexto de partida)", async () => {
  const cookie = await createSessionCookie();

  const res = await withoutLlmKeys(() =>
    app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        context: "match",
        match: { champion: "Ahri", win: true, kills: 5, deaths: 2, assists: 8 },
      }),
    })
  );

  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.code, "configuration");
  assertEquals(typeof body.error, "string");
  assertEquals(body.messages, undefined);
});

Deno.test("POST /ai/chat cae al error de configuración recuperable si no hay proveedores disponibles (pregunta de seguimiento sobre una partida)", async () => {
  const cookie = await createSessionCookie();

  const res = await withoutLlmKeys(() =>
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

  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.code, "configuration");
  assertEquals(typeof body.error, "string");
  assertEquals(body.messages, undefined);
});

Deno.test("POST /ai/chat cae al error de configuración recuperable si no hay proveedores disponibles (mensaje libre)", async () => {
  const cookie = await createSessionCookie();

  const res = await withoutLlmKeys(() =>
    app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        context: "general",
        message: "¿Cómo mejoro mi visión?",
      }),
    })
  );

  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.code, "configuration");
  assertEquals(typeof body.error, "string");
  assertEquals(body.messages, undefined);
});

Deno.test("Chat integrado respalda en Gemini tras cuota de Groq y mantiene 429 cuando ambos están limitados", async () => {
  const cookie = await createSessionCookie();
  const names = ["GROQ_API_KEY", "GEMINI_API_KEY"];
  const saved = names.map((name) => Deno.env.get(name));
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const request = () =>
    app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        context: "general",
        message: "¿Cómo mejoro mi visión?",
      }),
    });
  try {
    names.forEach((name) => Deno.env.set(name, "test-only"));
    globalThis.fetch = (url, init) => {
      calls.push(String(url));
      const body = JSON.parse(String(init?.body));
      assertEquals(
        body.messages[1].content.includes("¿Cómo mejoro mi visión?"),
        true,
      );
      return Promise.resolve(
        calls.length === 1
          ? new Response(null, {
            status: 429,
            headers: { "Retry-After": "60" },
          })
          : Response.json({
            choices: [{
              message: {
                content: "Practica colocar visión antes de disputar.",
              },
            }],
          }),
      );
    };
    const response = await request();
    assertEquals(response.status, 200);
    assertEquals(
      (await response.json()).messages[0].text,
      "Practica colocar visión antes de disputar.",
    );
    assertEquals(calls.length, 2);
    assertEquals(calls[0].includes("api.groq.com"), true);
    assertEquals(calls[1].includes("googleapis.com"), true);
    globalThis.fetch = (url) => {
      assertEquals(String(url).includes("googleapis.com"), true);
      return Promise.resolve(
        new Response(null, { status: 429, headers: { "Retry-After": "10" } }),
      );
    };
    const unavailable = await request();
    assertEquals(unavailable.status, 429);
    assertEquals(unavailable.headers.get("Retry-After"), "10");
    const body = await unavailable.json();
    assertEquals(body.code, "rate_limit");
    assertEquals(body.messages, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => {
      if (saved[i] === undefined) Deno.env.delete(name);
      else Deno.env.set(name, saved[i]!);
    });
  }
});
