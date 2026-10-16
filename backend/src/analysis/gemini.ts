import { generateCompletion, type GenerationOptions } from "./completion.ts";

export { LlmError as GeminiError } from "./completion.ts";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function generateExplanation(
  prompt: string,
  fetchFn: typeof fetch = fetch,
  options: GenerationOptions = {},
): Promise<string> {
  return generateCompletion(
    {
      name: "Gemini",
      apiKeyVariable: "GEMINI_API_KEY",
      model: Deno.env.get("GEMINI_MODEL")?.trim() || DEFAULT_GEMINI_MODEL,
      url:
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      tokenParameter: "max_tokens",
    },
    prompt,
    fetchFn,
    options,
  );
}
