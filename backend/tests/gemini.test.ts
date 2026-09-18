import "./test_setup.ts";
import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import { generateExplanation, GeminiError } from "../src/analysis/gemini.ts";

Deno.env.set("GEMINI_API_KEY", "test-key-for-gemini-tests");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("generateExplanation devuelve el texto de la respuesta de Gemini", async () => {
  const fetchFn = (() =>
    Promise.resolve(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "  Explicación generada.  " }] } }],
      }),
    )) as unknown as typeof fetch;

  const text = await generateExplanation("prompt de prueba", fetchFn);
  assertEquals(text, "Explicación generada.");
});

Deno.test("generateExplanation lanza GeminiError si Gemini responde con error HTTP", async () => {
  const fetchFn = (() =>
    Promise.resolve(jsonResponse({ error: "bad request" }, 400))) as unknown as typeof fetch;

  await assertRejects(() => generateExplanation("prompt", fetchFn), GeminiError);
});

Deno.test("generateExplanation lanza GeminiError si la respuesta no trae texto", async () => {
  const fetchFn = (() =>
    Promise.resolve(jsonResponse({ candidates: [] }))) as unknown as typeof fetch;

  await assertRejects(() => generateExplanation("prompt", fetchFn), GeminiError);
});

Deno.test("generateExplanation lanza GeminiError si no hay API key configurada", async () => {
  const original = Deno.env.get("GEMINI_API_KEY");
  Deno.env.delete("GEMINI_API_KEY");
  try {
    await assertRejects(() => generateExplanation("prompt"), GeminiError);
  } finally {
    if (original !== undefined) Deno.env.set("GEMINI_API_KEY", original);
  }
});
