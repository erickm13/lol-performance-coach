import { Context, Hono } from "jsr:@hono/hono@^4.6.0";
import { getCookie } from "jsr:@hono/hono@^4.6.0/cookie";
import { verifySessionToken } from "../auth/jwt.ts";

const SESSION_COOKIE = "session";

type ChatMessage = { role: "bot" | "user"; text: string };
type ChatContext = "general" | "match";

const CANNED_RESPONSES: Record<ChatContext, ChatMessage[]> = {
  general: [
    {
      role: "bot",
      text:
        "¡Hola! Preguntame lo que quieras sobre tu progreso, tus partidas o tu plan de entrenamiento.",
    },
  ],
  match: [
    {
      role: "bot",
      text: "Estoy revisando esta partida en base a tus métricas guardadas.",
    },
    {
      role: "bot",
      text:
        "Esta es una respuesta de ejemplo — el análisis todavía no está conectado a un modelo de IA real, pero el chat ya queda listo para cuando lo conectemos.",
    },
  ],
};

async function requireUserId(c: Context): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  return token ? await verifySessionToken(token) : null;
}

export const aiRoutes = new Hono();

aiRoutes.post("/chat", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const body = await c.req.json().catch(() => ({}));
  const context: ChatContext = body.context === "match" ? "match" : "general";

  return c.json({ messages: CANNED_RESPONSES[context] });
});
