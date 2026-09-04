import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { sign } from "jsr:@hono/hono@^4.6.0/jwt";
import { signSessionToken, verifySessionToken } from "../src/auth/jwt.ts";

Deno.test("signSessionToken y verifySessionToken hacen round-trip del id de usuario", async () => {
  const userId = crypto.randomUUID();
  const token = await signSessionToken(userId);
  const result = await verifySessionToken(token);
  assertEquals(result, userId);
});

Deno.test("verifySessionToken devuelve null con un token inválido", async () => {
  const result = await verifySessionToken("token-invalido");
  assertEquals(result, null);
});

Deno.test("verifySessionToken devuelve null con un token expirado", async () => {
  const secret = Deno.env.get("JWT_SECRET")!;
  const expiredToken = await sign(
    { sub: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) - 10 },
    secret,
  );

  const result = await verifySessionToken(expiredToken);
  assertEquals(result, null);
});
