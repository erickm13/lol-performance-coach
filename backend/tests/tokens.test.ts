import "./test_setup.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { db } from "../src/db/client.ts";
import { users, authTokens } from "../src/db/schema.ts";
import { createAuthToken, consumeAuthToken } from "../src/auth/tokens.ts";

async function createTestUser(): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  return user.id;
}

Deno.test("createAuthToken y consumeAuthToken hacen round-trip del user id", async () => {
  const userId = await createTestUser();
  const token = await createAuthToken(userId, "email_verification");

  const result = await consumeAuthToken(token, "email_verification");
  assertEquals(result, userId);
});

Deno.test("consumeAuthToken devuelve null si el token ya fue usado", async () => {
  const userId = await createTestUser();
  const token = await createAuthToken(userId, "email_verification");

  await consumeAuthToken(token, "email_verification");
  const secondAttempt = await consumeAuthToken(token, "email_verification");

  assertEquals(secondAttempt, null);
});

Deno.test("consumeAuthToken devuelve null con un token inexistente", async () => {
  const result = await consumeAuthToken(
    "token-que-no-existe",
    "email_verification",
  );
  assertEquals(result, null);
});

Deno.test("createAuthToken invalida tokens previos sin usar del mismo tipo y usuario", async () => {
  const userId = await createTestUser();
  const firstToken = await createAuthToken(userId, "password_reset");
  const secondToken = await createAuthToken(userId, "password_reset");

  const firstAttempt = await consumeAuthToken(firstToken, "password_reset");
  assertEquals(firstAttempt, null);

  const secondAttempt = await consumeAuthToken(secondToken, "password_reset");
  assertEquals(secondAttempt, userId);
});

Deno.test("consumeAuthToken devuelve null si el token ya expiró", async () => {
  const userId = await createTestUser();
  const [row] = await db
    .insert(authTokens)
    .values({
      userId,
      type: "password_reset",
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() - 1000),
    })
    .returning();

  const result = await consumeAuthToken(row.token, "password_reset");
  assertEquals(result, null);
});
