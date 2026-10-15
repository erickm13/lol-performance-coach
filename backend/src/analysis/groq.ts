const GROQ_MODEL = "openai/gpt-oss-20b";
const GROQ_TIMEOUT_MS = 15_000;

export type GroqErrorCode =
  | "configuration"
  | "rate_limit"
  | "timeout"
  | "invalid_response"
  | "upstream";

export class GroqError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions,
    public readonly code: GroqErrorCode = "invalid_response",
    public readonly retryAfterSeconds?: number,
  ) {
    super(message, options);
    this.name = "GroqError";
  }
}

type GenerationOptions = {
  timeoutMs?: number;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  maxCompletionTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
};

function getApiKey(): string {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) {
    throw new GroqError(
      "La variable de entorno GROQ_API_KEY es requerida",
      undefined,
      "configuration",
    );
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
  const timedOut = err instanceof Error &&
    ["TimeoutError", "AbortError"].includes(err.name);
  // No exponemos cuerpos del proveedor ni mensajes de red que puedan contener datos.
  return new GroqError(
    timedOut ? "Groq agotó el tiempo de respuesta" : context,
    { cause: err },
    timedOut ? "timeout" : "upstream",
  );
}

export async function generateExplanation(
  prompt: string,
  fetchFn: typeof fetch = fetch,
  options: GenerationOptions = {},
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
        ...(options.jsonSchema
          ? {
            response_format: {
              type: "json_schema",
              json_schema: { ...options.jsonSchema, strict: true },
            },
          }
          : {}),
        ...(options.maxCompletionTokens
          ? { max_completion_tokens: options.maxCompletionTokens }
          : {}),
        ...(options.reasoningEffort
          ? { reasoning_effort: options.reasoningEffort }
          : {}),
        messages: [
          {
            role: "system",
            content:
              "Responde siempre en español neutro y dirígete al jugador de tú, con conjugaciones de tuteo: tienes, puedes, revisa, comprueba. No uses voseo (vos, sos, tenés, podés, revisá). Respeta el formato solicitado y basa las afirmaciones únicamente en los datos aportados.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? GROQ_TIMEOUT_MS),
    });

    if (!res.ok) {
      const retryAfter = res.headers.get("retry-after");
      const seconds = retryAfter === null
        ? NaN
        : /^\d+(?:\.\d+)?$/.test(retryAfter)
        ? Number(retryAfter)
        : (Date.parse(retryAfter) - Date.now()) / 1000;
      // Consumimos el cuerpo para no dejar el recurso colgado.
      await res.body?.cancel();
      throw new GroqError(
        `Groq respondió ${res.status}`,
        undefined,
        res.status === 429
          ? "rate_limit"
          : res.status === 401 || res.status === 403
          ? "configuration"
          : "upstream",
        res.status === 429
          ? Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : 60
          : undefined,
      );
    }

    data = await res.json();
  } catch (err) {
    throw asGroqError(err, "Falló la llamada a Groq");
  }

  const parsed = data as
    | {
      choices?: {
        finish_reason?: string;
        message?: { content?: unknown };
      }[];
    }
    | null
    | undefined;
  const text = parsed?.choices?.[0]?.message?.content;
  if (parsed?.choices?.[0]?.finish_reason === "length") {
    throw new GroqError("Groq devolvió una respuesta incompleta");
  }
  if (typeof text !== "string" || text.trim() === "") {
    throw new GroqError("Groq no devolvió texto");
  }
  return text.trim();
}
