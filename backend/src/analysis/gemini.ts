const GEMINI_MODEL = "gemini-2.0-flash";

export class GeminiError extends Error {}

function getApiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new GeminiError("La variable de entorno GEMINI_API_KEY es requerida");
  }
  return key;
}

export async function generateExplanation(
  prompt: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const apiKey = getApiKey();
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    throw new GeminiError(`Gemini respondió ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim() === "") {
    throw new GeminiError("Gemini no devolvió texto");
  }
  return text.trim();
}
