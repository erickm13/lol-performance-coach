const GROQ_MODEL = "openai/gpt-oss-20b";
const GROQ_TIMEOUT_MS = 15_000;

export class GroqError extends Error {}

function getApiKey(): string {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) {
    throw new GroqError("La variable de entorno GROQ_API_KEY es requerida");
  }
  return key;
}

/**
 * Convierte cualquier fallo en un `GroqError`. El llamador
 * (`generateTrainingPlan`) distingue el fallback solo-reglas por
 * `instanceof GroqError`, así que todo modo de falla de esta función —key
 * ausente, HTTP no-2xx, red caída, timeout, JSON inválido, respuesta vacía—
 * tiene que llegar como `GroqError` o el plan entero revienta con un 500.
 */
function asGroqError(err: unknown, context: string): GroqError {
  if (err instanceof GroqError) return err;
  const detail = err instanceof Error ? err.message : String(err);
  // Nunca incluimos la API key en el mensaje: viaja por header, no por URL.
  return new GroqError(`${context}: ${detail}`, { cause: err });
}

export async function generateExplanation(
  prompt: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const apiKey = getApiKey();
  const url = "https://api.groq.com/openai/v1/chat/completions";

  let data: unknown;
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Consumimos el cuerpo para no dejar el recurso colgado.
      await res.body?.cancel();
      throw new GroqError(`Groq respondió ${res.status}`);
    }

    data = await res.json();
  } catch (err) {
    throw asGroqError(err, "Falló la llamada a Groq");
  }

  const parsed = data as
    | { choices?: { message?: { content?: unknown } }[] }
    | null
    | undefined;
  const text = parsed?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim() === "") {
    throw new GroqError("Groq no devolvió texto");
  }
  return text.trim();
}
