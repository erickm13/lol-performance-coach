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

Deno.test("POST /ai/chat devuelve el análisis de ejemplo para contexto de partida", async () => {
  const cookie = await createSessionCookie();

  const res = await app.request("/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ context: "match" }),
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.messages.length, 2);
});
