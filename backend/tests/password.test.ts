import { assertEquals, assertNotEquals } from "jsr:@std/assert@^1.0.0";
import { hashPassword, verifyPassword } from "../src/auth/password.ts";

Deno.test("hashPassword produce un hash distinto del texto plano", async () => {
  const hash = await hashPassword("password123");
  assertNotEquals(hash, "password123");
});

Deno.test("verifyPassword devuelve true para la contraseña correcta", async () => {
  const hash = await hashPassword("password123");
  const result = await verifyPassword("password123", hash);
  assertEquals(result, true);
});

Deno.test("verifyPassword devuelve false para una contraseña incorrecta", async () => {
  const hash = await hashPassword("password123");
  const result = await verifyPassword("wrongpassword", hash);
  assertEquals(result, false);
});
