import { generateCompletion, type GenerationOptions } from "./completion.ts";

// Compatibility for existing consumers and injected failures in plan tests.
export { LlmError as GroqError } from "./completion.ts";
export type { LlmErrorCode as GroqErrorCode } from "./completion.ts";

export function generateExplanation(
  prompt: string,
  fetchFn: typeof fetch = fetch,
  options: GenerationOptions = {},
): Promise<string> {
  return generateCompletion(
    {
      name: "Groq",
      apiKeyVariable: "GROQ_API_KEY",
      model: "openai/gpt-oss-20b",
      url: "https://api.groq.com/openai/v1/chat/completions",
      tokenParameter: "max_completion_tokens",
    },
    prompt,
    fetchFn,
    options,
  );
}
