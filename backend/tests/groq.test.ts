import "./test_setup.ts";
import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { generateExplanation, GroqError } from "../src/analysis/groq.ts";

const TEST_API_KEY = "test-key-for-groq-tests";

/**
 * Setea GROQ_API_KEY solo mientras corre `fn` y la restaura después.
 * `Deno.env` es global al proceso de test: si la dejáramos seteada a nivel de
 * módulo, se filtraría a los otros archivos de test (que corren en el mismo
 * proceso) y los haría llamar a la API real de Groq.
 */
async function withApiKey(fn: () => Promise<void>): Promise<void> {
  const original = Deno.env.get("GROQ_API_KEY");
  Deno.env.set("GROQ_API_KEY", TEST_API_KEY);
  try {
    await fn();
  } finally {
    if (original === undefined) Deno.env.delete("GROQ_API_KEY");
    else Deno.env.set("GROQ_API_KEY", original);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("generateExplanation devuelve el texto de la respuesta de Groq", async () => {
  await withApiKey(async () => {
    const fetchFn = (() =>
      Promise.resolve(
        jsonResponse({
          choices: [{ message: { content: "  Explicación generada.  " } }],
        }),
      )) as unknown as typeof fetch;

    const text = await generateExplanation("prompt de prueba", fetchFn);
    assertEquals(text, "Explicación generada.");
  });
});

Deno.test("generateExplanation lanza GroqError si Groq responde con error HTTP", async () => {
  await withApiKey(async () => {
    const fetchFn = (() =>
      Promise.resolve(jsonResponse({ error: "bad request" }, 400))) as unknown as typeof fetch;

    await assertRejects(() => generateExplanation("prompt", fetchFn), GroqError);
  });
});

Deno.test("generateExplanation lanza GroqError si la respuesta no trae texto", async () => {
  await withApiKey(async () => {
    const fetchFn = (() =>
      Promise.resolve(jsonResponse({ choices: [] }))) as unknown as typeof fetch;

    await assertRejects(() => generateExplanation("prompt", fetchFn), GroqError);
  });
});

Deno.test("generateExplanation lanza GroqError si no hay API key configurada", async () => {
  const original = Deno.env.get("GROQ_API_KEY");
  Deno.env.delete("GROQ_API_KEY");
  try {
    await assertRejects(() => generateExplanation("prompt"), GroqError);
  } finally {
    if (original !== undefined) Deno.env.set("GROQ_API_KEY", original);
  }
});

Deno.test("generateExplanation lanza GroqError (no TypeError) si falla la red", async () => {
  await withApiKey(async () => {
    // Simula una caída de red cruda (DNS, conexión rechazada): Deno la reporta
    // como `TypeError: error sending request`, NO como una respuesta HTTP.
    const fetchFn = (() =>
      Promise.reject(new TypeError("error sending request for url"))) as unknown as typeof fetch;

    await assertRejects(() => generateExplanation("prompt", fetchFn), GroqError);
  });
});

Deno.test("generateExplanation lanza GroqError si la llamada se aborta por timeout", async () => {
  await withApiKey(async () => {
    const fetchFn = (() =>
      Promise.reject(new DOMException("Signal timed out.", "TimeoutError"))) as unknown as
        typeof fetch;

    await assertRejects(() => generateExplanation("prompt", fetchFn), GroqError);
  });
});

Deno.test("generateExplanation lanza GroqError si el cuerpo no es JSON válido", async () => {
  await withApiKey(async () => {
    const fetchFn = (() =>
      Promise.resolve(
        new Response("no soy json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )) as unknown as typeof fetch;

    await assertRejects(() => generateExplanation("prompt", fetchFn), GroqError);
  });
});

Deno.test("generateExplanation manda la API key por header Authorization", async () => {
  await withApiKey(async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    const fetchFn = ((url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init.headers ?? {}) as Record<string, string>;
      return Promise.resolve(
        jsonResponse({
          choices: [{ message: { content: "ok" } }],
        }),
      );
    }) as unknown as typeof fetch;

    await generateExplanation("prompt", fetchFn);

    assertEquals(capturedUrl.includes(TEST_API_KEY), false);
    assertStringIncludes(capturedUrl, "api.groq.com");
    assertEquals(capturedHeaders["Authorization"], `Bearer ${TEST_API_KEY}`);
  });
});

Deno.test("generateExplanation aborta la llamada con un timeout", async () => {
  await withApiKey(async () => {
    let capturedSignal: AbortSignal | null | undefined;

    const fetchFn = ((_url: string, init: RequestInit) => {
      capturedSignal = init.signal;
      return Promise.resolve(
        jsonResponse({
          choices: [{ message: { content: "ok" } }],
        }),
      );
    }) as unknown as typeof fetch;

    await generateExplanation("prompt", fetchFn);

    assertEquals(capturedSignal instanceof AbortSignal, true);
  });
});
