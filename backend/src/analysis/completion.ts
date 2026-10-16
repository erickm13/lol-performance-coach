const DEFAULT_TIMEOUT_MS = 15_000;

export type LlmErrorCode =
  | "configuration"
  | "rate_limit"
  | "timeout"
  | "invalid_response"
  | "upstream";

export class LlmError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions,
    public readonly code: LlmErrorCode = "invalid_response",
    public readonly retryAfterSeconds?: number,
    public readonly status?: number,
  ) {
    super(message, options);
    this.name = "LlmError";
  }
}

export type GenerationOptions = {
  timeoutMs?: number;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  maxCompletionTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
};

type CompletionProvider = {
  name: string;
  apiKeyVariable: string;
  model: string;
  url: string;
  tokenParameter: "max_completion_tokens" | "max_tokens";
};

/** Shared transport: never expose provider bodies, credentials or raw network errors. */
export async function generateCompletion(
  provider: CompletionProvider,
  prompt: string,
  fetchFn: typeof fetch = fetch,
  options: GenerationOptions = {},
): Promise<string> {
  const apiKey = Deno.env.get(provider.apiKeyVariable)?.trim();
  if (!apiKey) {
    throw new LlmError(
      `La variable de entorno ${provider.apiKeyVariable} es requerida`,
      undefined,
      "configuration",
    );
  }

  let data: unknown;
  try {
    const res = await fetchFn(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        ...(options.jsonSchema
          ? {
            response_format: {
              type: "json_schema",
              json_schema: { ...options.jsonSchema, strict: true },
            },
          }
          : {}),
        ...(options.maxCompletionTokens
          ? { [provider.tokenParameter]: options.maxCompletionTokens }
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
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const retryAfter = res.headers.get("retry-after");
      const seconds = retryAfter === null
        ? NaN
        : /^\d+(?:\.\d+)?$/.test(retryAfter)
        ? Number(retryAfter)
        : (Date.parse(retryAfter) - Date.now()) / 1000;
      // Gemini can report an invalid key as HTTP 400 with API_KEY_INVALID.
      // Inspect only the machine-readable reason; never forward the error body.
      let invalidKey = false;
      if (res.status === 400 && provider.name === "Gemini") {
        const body = await res.json().catch(() => null);
        invalidKey = Array.isArray(body?.error?.details) &&
          body.error.details.some((detail: { reason?: unknown } | null) =>
            detail?.reason === "API_KEY_INVALID"
          );
      } else {
        await res.body?.cancel();
      }
      throw new LlmError(
        `${provider.name} respondió ${res.status}`,
        undefined,
        res.status === 429
          ? "rate_limit"
          : invalidKey || [401, 403, 404].includes(res.status)
          ? "configuration"
          : "upstream",
        res.status === 429
          ? Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : 60
          : undefined,
        res.status,
      );
    }

    try {
      data = await res.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new LlmError(`${provider.name} no devolvió JSON válido`);
      }
      throw error;
    }
  } catch (err) {
    if (err instanceof LlmError) throw err;
    const timedOut = err instanceof Error &&
      ["TimeoutError", "AbortError"].includes(err.name);
    throw new LlmError(
      timedOut
        ? `${provider.name} agotó el tiempo de respuesta`
        : `Falló la llamada a ${provider.name}`,
      { cause: err },
      timedOut ? "timeout" : "upstream",
    );
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
    throw new LlmError(`${provider.name} devolvió una respuesta incompleta`);
  }
  if (typeof text !== "string" || text.trim() === "") {
    throw new LlmError(`${provider.name} no devolvió texto`);
  }
  return text.trim();
}
