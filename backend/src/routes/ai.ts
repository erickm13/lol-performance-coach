import { Context, Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { verifySessionToken } from "../auth/jwt.ts";
import { generateExplanation, GroqError } from "../analysis/groq.ts";

const SESSION_COOKIE = "session";

type ChatMessage = { role: "bot" | "user"; text: string };
type ChatContext = "general" | "match";

type MatchSummary = {
  champion?: string;
  win?: boolean;
  kills?: number;
  deaths?: number;
  assists?: number;
  csPerMin?: number;
  kda?: number;
};

const GENERAL_GREETING: ChatMessage = {
  role: "bot",
  text: "¡Hola! Preguntame lo que quieras sobre tu progreso, tus partidas o tu plan de entrenamiento.",
};

const FALLBACK_MESSAGE: ChatMessage = {
  role: "bot",
  text: "No pude conectar con la IA en este momento. Intentá de nuevo en un rato.",
};

async function requireUserId(c: Context): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  return token ? await verifySessionToken(token) : null;
}

function buildMatchPrompt(match: MatchSummary): string {
  const resultLabel = match.win ? "Victoria" : "Derrota";
  const kdaLine = `${match.kills ?? "?"}/${match.deaths ?? "?"}/${match.assists ?? "?"}`;
  return (
    `Sos un coach de League of Legends. Analizá brevemente esta partida en 2-4 oraciones, ` +
    `en español, con un tono directo y constructivo. No inventes datos que no te di.\n` +
    `- Campeón: ${match.champion ?? "desconocido"}\n` +
    `- Resultado: ${resultLabel}\n` +
    `- KDA: ${kdaLine}${match.kda !== undefined ? ` (ratio ${match.kda})` : ""}\n` +
    `${match.csPerMin !== undefined ? `- CS/min: ${match.csPerMin}\n` : ""}` +
    `Dale un consejo concreto para la próxima partida con este campeón.`
  );
}

function buildGeneralPrompt(message: string): string {
  return (
    `Sos un coach de League of Legends que ayuda a un jugador a mejorar. Respondé en ` +
    `español, en 2-4 oraciones, de forma directa y práctica.\n` +
    `Pregunta del jugador: "${message}"`
  );
}

export const aiRoutes = new Hono();

aiRoutes.post("/chat", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const body = await c.req.json().catch(() => ({}));
  const context: ChatContext = body.context === "match" ? "match" : "general";

  // Abrir el chat general sin haber escrito nada todavía: saludo fijo, sin
  // gastar una llamada a la IA en algo que no depende de ningún dato.
  if (context === "general" && !body.message) {
    return c.json({ messages: [GENERAL_GREETING] });
  }

  const prompt = context === "match"
    ? buildMatchPrompt((body.match ?? {}) as MatchSummary)
    : buildGeneralPrompt(String(body.message));

  try {
    const text = await generateExplanation(prompt);
    return c.json({ messages: [{ role: "bot", text }] });
  } catch (err) {
    if (!(err instanceof GroqError)) throw err;
    return c.json({ messages: [FALLBACK_MESSAGE] });
  }
});
