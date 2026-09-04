import { sign, verify } from "jsr:@hono/hono@^4.6.0/jwt";

const SESSION_DURATION_SECONDS = 60 * 60 * 2;

function getSecret(): string {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) {
    throw new Error("La variable de entorno JWT_SECRET es requerida");
  }
  return secret;
}

export async function signSessionToken(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  return await sign({ sub: userId, exp }, getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<string | null> {
  try {
    const payload = await verify(token, getSecret(), "HS256");
    return payload.sub as string;
  } catch {
    return null;
  }
}
