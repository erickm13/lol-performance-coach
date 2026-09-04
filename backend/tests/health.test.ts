import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { app } from "../src/app.ts";

Deno.test("GET /health responde 200 y confirma la conexión a la base de datos", async () => {
  const res = await app.request("/health");
  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(body.status, "ok");
  assertEquals(body.db, "connected");
});
