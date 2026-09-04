import { encodeBase64Url } from "jsr:@std/encoding@^1.0.0/base64url";
import { and, eq, isNull, gt } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import { authTokens } from "../db/schema.ts";

export type AuthTokenType = "email_verification" | "password_reset";

const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  email_verification: 1000 * 60 * 60 * 24,
  password_reset: 1000 * 60 * 60,
};

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export async function createAuthToken(
  userId: string,
  type: AuthTokenType,
): Promise<string> {
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
      ),
    );

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[type]);

  await db.insert(authTokens).values({ userId, type, token, expiresAt });

  return token;
}

export async function consumeAuthToken(
  token: string,
  type: AuthTokenType,
): Promise<string | null> {
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.token, token),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .returning();

  if (!row) {
    return null;
  }

  return row.userId;
}
