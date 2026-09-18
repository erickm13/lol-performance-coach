const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 15_000;

export class GeminiError extends Error {}

function getApiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new GeminiError("La variable de entorno GEMINI_API_KEY es requerida");
  }
  return key;
}

/**
 * Convierte cualquier fallo en un `GeminiError`. El llamador
 * (`generateTrainingPlan`) distingue el fallback solo-reglas por
 * `instanceof GeminiError`, así que todo modo de falla de esta función —key
 * ausente, HTTP no-2xx, red caída, timeout, JSON inválido, respuesta vacía—
 * tiene que llegar como `GeminiError` o el plan entero revienta con un 500.
 */
function asGeminiError(err: unknown, context: string): GeminiError {
  if (err instanceof GeminiError) return err;
  const detail = err instanceof Error ? err.message : String(err);
  // Nunca incluimos la URL ni la API key en el mensaje: la key viaja por header.
  return new GeminiError(`${context}: ${detail}`, { cause: err });
}

export async function generateExplanation(
  prompt: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const apiKey = getApiKey();
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  let data: unknown;
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Consumimos el cuerpo para no dejar el recurso colgado.
      await res.body?.cancel();
      throw new GeminiError(`Gemini respondió ${res.status}`);
    }

    data = await res.json();
  } catch (err) {
    throw asGeminiError(err, "Falló la llamada a Gemini");
  }

  const parsed = data as
    | { candidates?: { content?: { parts?: { text?: unknown }[] } }[] }
    | null
    | undefined;
  const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim() === "") {
    throw new GeminiError("Gemini no devolvió texto");
  }
  return text.trim();
}
