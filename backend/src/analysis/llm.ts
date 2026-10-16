import { type GenerationOptions, LlmError } from "./completion.ts";
import { generateExplanation as gemini } from "./gemini.ts";
import { generateExplanation as groq } from "./groq.ts";

export { LlmError } from "./completion.ts";

type Provider = "groq" | "gemini";
type RoutingOptions = GenerationOptions & { preferredProvider?: Provider };
const clients = { groq, gemini };
const keyVariables = { groq: "GROQ_API_KEY", gemini: "GEMINI_API_KEY" };

/** One attempt per available provider; quota waits are shared by chat, plan and map. */
export function createExplanationGenerator(now: () => number = Date.now) {
  const rateLimitUntil = new Map<Provider, number>();

  return async function generateExplanation(
    prompt: string,
    fetchFn: typeof fetch = fetch,
    options: RoutingOptions = {},
  ): Promise<string> {
    const preferred = options.preferredProvider ?? "groq";
    const order: Provider[] = preferred === "gemini"
      ? ["gemini", "groq"]
      : ["groq", "gemini"];
    const configured = order.filter((provider) =>
      Deno.env.get(keyVariables[provider])?.trim()
    );
    if (!configured.length) {
      throw new LlmError(
        "Configura GROQ_API_KEY o GEMINI_API_KEY para usar el coach",
        undefined,
        "configuration",
      );
    }

    let transientFailure: LlmError | undefined;
    for (const provider of configured) {
      if ((rateLimitUntil.get(provider) ?? 0) > now()) continue;
      try {
        return await clients[provider](prompt, fetchFn, options);
      } catch (error) {
        if (!(error instanceof LlmError)) throw error;
        if (error.code !== "rate_limit") {
          const transient = error.code === "timeout" ||
            (error.code === "upstream" &&
              (error.status === undefined || error.status === 408 ||
                error.status >= 500));
          // Invalid keys, malformed requests and invalid output still fail immediately.
          if (!transient) throw error;
          transientFailure = error;
          continue;
        }
        rateLimitUntil.set(
          provider,
          Math.max(
            rateLimitUntil.get(provider) ?? 0,
            now() + (error.retryAfterSeconds ?? 60) * 1000,
          ),
        );
      }
    }

    // A temporary service failure keeps its classification if the backup also fails.
    if (transientFailure) throw transientFailure;

    // Resume as soon as any configured provider is available again.
    const earliest = Math.min(
      ...configured.map((provider) => rateLimitUntil.get(provider)!),
    );
    throw new LlmError(
      "Los proveedores del coach alcanzaron su límite de uso",
      undefined,
      "rate_limit",
      Math.max(1, Math.ceil((earliest - now()) / 1000)),
    );
  };
}

export const generateExplanation = createExplanationGenerator();
