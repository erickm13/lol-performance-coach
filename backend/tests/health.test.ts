import "./test_setup.ts";
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { app } from "../src/app.ts";
import { db } from "../src/db/client.ts";
import { signSessionToken } from "../src/auth/jwt.ts";

Deno.test("GET /health responde 200 y confirma la conexión a la base de datos", async () => {
  const res = await app.request("/health");
  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(body.status, "ok");
  assertEquals(body.db, "connected");
});

Deno.test("GET /health incluye cabeceras CORS para que el frontend pueda consumirlo", async () => {
  const res = await app.request("/health", {
    headers: { Origin: "http://localhost:3000" },
  });

  assertEquals(
    res.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );
});

Deno.test("JSON malformado en registro es un error de entrada 400 con JSON { error }", async () => {
  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  });
  const body = await res.json();

  assertEquals(res.status, 400);
  assertEquals(typeof body.error, "string");
});

Deno.test("un fallo inesperado conserva el JSON 500 del onError global sin exponer detalles", async () => {
  const original = db.select;
  const token = await signSessionToken(crypto.randomUUID());
  db.select = () => {
    throw new Error("detalle interno que no debe filtrarse");
  };
  try {
    const res = await app.request("/settings/profile", {
      headers: { Cookie: `session=${token}` },
    });
    assertEquals(res.status, 500);
    assertEquals(await res.json(), { error: "Error interno del servidor" });
  } finally {
    db.select = original;
  }
});
