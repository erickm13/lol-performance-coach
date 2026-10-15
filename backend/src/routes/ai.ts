import { Context, Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { verifySessionToken } from "../auth/jwt.ts";
import { generateExplanation, GroqError } from "../analysis/groq.ts";

const SESSION_COOKIE = "session";

type ChatMessage = { role: "bot" | "user"; text: string };
type ChatContext = "general" | "match";

type MatchSummary = {
  summonerName?: string;
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
  text:
    "¡Hola! Pregúntame lo que quieras sobre tu progreso, tus partidas o tu plan de entrenamiento.",
};

const FALLBACK_MESSAGE: ChatMessage = {
  role: "bot",
  text:
    "No pude conectar con la IA en este momento. Intenta de nuevo en un rato.",
};

async function requireUserId(c: Context): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  return token ? await verifySessionToken(token) : null;
}

function matchDataBlock(match: MatchSummary): string {
  const kdaLine = `${match.kills ?? "?"}/${match.deaths ?? "?"}/${
    match.assists ?? "?"
  }`;
  return (
    `- Campeón: ${match.champion ?? "desconocido"}\n` +
    `- Resultado: ${match.win ? "Victoria" : "Derrota"}\n` +
    `- KDA: ${kdaLine}${
      match.kda !== undefined ? ` (ratio ${match.kda})` : ""
    }\n` +
    `${match.csPerMin !== undefined ? `- CS/min: ${match.csPerMin}\n` : ""}`
  );
}

/**
 * Primer mensaje al abrir el análisis de una partida: saluda por nombre,
 * resume el resultado, tira un chiste corto acorde (festejo si ganó, algo
 * liviano si perdió, nunca burlón) y termina invitando a preguntar algo
 * puntual sobre esa partida — el usuario sigue la conversación desde ahí.
 */
function buildMatchOpenerPrompt(match: MatchSummary): string {
  const name = match.summonerName ?? "campeón";
  return (
    `Eres el coach personal de League of Legends de ${name}, hablándole directo como en un chat, ` +
    `no como si estuvieras redactando un informe. Escribe un solo mensaje breve en español ` +
    `(4-6 oraciones), en un tono cercano y natural, que fluya como una conversación real: sin ` +
    `numerar partes, sin encabezados ni etiquetas como "El chiste:" o "Resumen:", sin ` +
    `estructurarlo como una lista. Tiene que sonar como si un amigo te estuviera hablando.\n\n` +
    `Comienza saludando a ${name} por su nombre de forma natural, menciona de pasada cómo le fue ` +
    `en esta partida (campeón, resultado, KDA) integrado en la misma conversación, añade un ` +
    `chiste corto que surja naturalmente del resultado — festejando si ganó, o algo liviano y ` +
    `cariñoso si perdió, nunca cruel ni burlón — y cierra preguntándole qué quiere saber o ` +
    `preguntar sobre esa partida en particular. No inventes datos que no te di.\n\n` +
    `Datos de la partida:\n${matchDataBlock(match)}`
  );
}

/**
 * Pregunta de seguimiento dentro del mismo chat de análisis: mismo jugador,
 * misma partida, pero ya no hace falta repetir el saludo ni el chiste.
 */
function buildMatchFollowUpPrompt(
  match: MatchSummary,
  message: string,
): string {
  const name = match.summonerName ?? "campeón";
  return (
    `Eres el coach personal de League of Legends de ${name}, respondiendo una pregunta de ` +
    `seguimiento sobre esta partida puntual. Responde en español, en 2-4 oraciones, directo y ` +
    `práctico, sin repetir el saludo. No inventes datos que no te di.\n\n` +
    `Datos de la partida:\n${matchDataBlock(match)}\n` +
    `Pregunta de ${name}: "${message}"`
  );
}

function buildGeneralPrompt(message: string): string {
  return (
    `Eres un coach de League of Legends que ayuda a un jugador a mejorar. Responde en ` +
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

  const match = (body.match ?? {}) as MatchSummary;
  const prompt = context === "match"
    ? (body.message
      ? buildMatchFollowUpPrompt(match, String(body.message))
      : buildMatchOpenerPrompt(match))
    : buildGeneralPrompt(String(body.message));

  try {
    const text = await generateExplanation(prompt);
    return c.json({ messages: [{ role: "bot", text }] });
  } catch (err) {
    if (!(err instanceof GroqError)) throw err;
    return c.json({ messages: [FALLBACK_MESSAGE] });
  }
});
