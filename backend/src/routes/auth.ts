import { Hono } from "jsr:@hono/hono@^4.6.0";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "jsr:@hono/hono@^4.6.0/cookie";
import { eq } from "npm:drizzle-orm@^0.36.0";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { signSessionToken, verifySessionToken } from "../auth/jwt.ts";
import { createAuthToken, consumeAuthToken } from "../auth/tokens.ts";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 2;

export type AuthEmailDeps = {
  sendVerificationEmail: (to: string, token: string) => Promise<void>;
  sendPasswordResetEmail: (to: string, token: string) => Promise<void>;
};

function isProduction(): boolean {
  return Deno.env.get("DENO_ENV") === "production";
}

export function createAuthRoutes(deps: AuthEmailDeps): Hono {
  const auth = new Hono();

  auth.post("/register", async (c) => {
    const { email, password } = (await c.req.json()) as {
      email?: string;
      password?: string;
    };

    if (
      typeof email !== "string" ||
      !email.includes("@") ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return c.json(
        { error: "Email inválido o contraseña muy corta (mínimo 8 caracteres)" },
        400,
      );
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      return c.json({ error: "Ese email ya está registrado" }, 409);
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning();

    const token = await createAuthToken(user.id, "email_verification");
    await deps.sendVerificationEmail(email, token);

    return c.json({ id: user.id, email: user.email }, 201);
  });

  auth.post("/login", async (c) => {
    const { email, password } = (await c.req.json()) as {
      email?: string;
      password?: string;
    };

    if (typeof email !== "string" || typeof password !== "string") {
      return c.json({ error: "Email y contraseña son requeridos" }, 400);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return c.json({ error: "Credenciales inválidas" }, 401);
    }

    const token = await signSessionToken(user.id);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return c.json({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });
  });

  auth.post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  auth.get("/me", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    const userId = token ? await verifySessionToken(token) : null;
    if (!userId) {
      return c.json({ error: "No autenticado" }, 401);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      return c.json({ error: "No autenticado" }, 401);
    }

    return c.json({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });
  });

  auth.post("/verify-email", async (c) => {
    const { token } = (await c.req.json()) as { token?: string };
    if (typeof token !== "string") {
      return c.json({ error: "Token inválido o expirado" }, 400);
    }

    const userId = await consumeAuthToken(token, "email_verification");
    if (!userId) {
      return c.json({ error: "Token inválido o expirado" }, 400);
    }

    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId));
    return c.json({ ok: true });
  });

  auth.post("/forgot-password", async (c) => {
    const { email } = (await c.req.json()) as { email?: string };
    if (typeof email === "string") {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (user) {
        const token = await createAuthToken(user.id, "password_reset");
        await deps.sendPasswordResetEmail(email, token);
      }
    }
    return c.json({ ok: true });
  });

  auth.post("/reset-password", async (c) => {
    const { token, newPassword } = (await c.req.json()) as {
      token?: string;
      newPassword?: string;
    };
    if (
      typeof token !== "string" ||
      typeof newPassword !== "string" ||
      newPassword.length < 8
    ) {
      return c.json({ error: "Datos inválidos" }, 400);
    }

    const userId = await consumeAuthToken(token, "password_reset");
    if (!userId) {
      return c.json({ error: "Token inválido o expirado" }, 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    return c.json({ ok: true });
  });

  return auth;
}
