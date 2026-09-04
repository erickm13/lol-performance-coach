import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";
import { sign } from "jsr:@hono/hono@^4.6.0/jwt";
import { createAuthRoutes } from "../src/routes/auth.ts";

function createTestApp() {
  const sentEmails: { to: string; token: string; kind: "verify" | "reset" }[] = [];
  const app = createAuthRoutes({
    sendVerificationEmail: (to, token) => {
      sentEmails.push({ to, token, kind: "verify" });
      return Promise.resolve();
    },
    sendPasswordResetEmail: (to, token) => {
      sentEmails.push({ to, token, kind: "reset" });
      return Promise.resolve();
    },
  });
  return { app, sentEmails };
}

function uniqueEmail(): string {
  return `user-${crypto.randomUUID()}@example.com`;
}

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie");
  assertExists(setCookie);
  return setCookie!.split(";")[0];
}

Deno.test("POST /register crea un usuario y envía email de verificación", async () => {
  const { app, sentEmails } = createTestApp();
  const email = uniqueEmail();

  const res = await app.request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });

  assertEquals(res.status, 201);
  assertEquals(sentEmails.length, 1);
  assertEquals(sentEmails[0].to, email);
  assertEquals(sentEmails[0].kind, "verify");
});

Deno.test("POST /register rechaza un email ya registrado", async () => {
  const { app } = createTestApp();
  const email = uniqueEmail();

  await app.request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });

  const res = await app.request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "otherpassword" }),
  });

  assertEquals(res.status, 409);
});

Deno.test("flujo completo: registro, verificación, login, /me, logout", async () => {
  const { app, sentEmails } = createTestApp();
  const email = uniqueEmail();
  const password = "password123";

  await app.request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const verifyToken = sentEmails[0].token;

  const verifyRes = await app.request("/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: verifyToken }),
  });
  assertEquals(verifyRes.status, 200);

  const loginRes = await app.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assertEquals(loginRes.status, 200);
  const loginBody = await loginRes.json();
  assertEquals(loginBody.emailVerified, true);

  const cookie = extractSessionCookie(loginRes);

  const meRes = await app.request("/me", { headers: { Cookie: cookie } });
  assertEquals(meRes.status, 200);
  const meBody = await meRes.json();
  assertEquals(meBody.email, email);

  const logoutRes = await app.request("/logout", { method: "POST" });
  assertEquals(logoutRes.status, 200);

  const meAfterLogout = await app.request("/me");
  assertEquals(meAfterLogout.status, 401);
});

Deno.test("POST /login rechaza credenciales inválidas", async () => {
  const { app } = createTestApp();
  const email = uniqueEmail();

  await app.request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });

  const res = await app.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "wrongpassword" }),
  });

  assertEquals(res.status, 401);
});

Deno.test("GET /me sin cookie responde 401", async () => {
  const { app } = createTestApp();
  const res = await app.request("/me");
  assertEquals(res.status, 401);
});

Deno.test("GET /me con una cookie de sesión expirada responde 401", async () => {
  const { app } = createTestApp();
  const secret = Deno.env.get("JWT_SECRET")!;
  const expiredToken = await sign(
    { sub: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) - 10 },
    secret,
  );

  const res = await app.request("/me", {
    headers: { Cookie: `session=${expiredToken}` },
  });
  assertEquals(res.status, 401);
});

Deno.test("POST /verify-email con token inválido responde 400", async () => {
  const { app } = createTestApp();
  const res = await app.request("/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "not-a-real-token" }),
  });
  assertEquals(res.status, 400);
});

Deno.test("flujo de recuperación de contraseña: forgot-password + reset-password + login con la nueva contraseña", async () => {
  const { app, sentEmails } = createTestApp();
  const email = uniqueEmail();
  const oldPassword = "password123";
  const newPassword = "newpassword456";

  await app.request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: oldPassword }),
  });

  await app.request("/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const resetToken = sentEmails.find((e) => e.kind === "reset")!.token;

  const resetRes = await app.request("/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, newPassword }),
  });
  assertEquals(resetRes.status, 200);

  const oldLoginRes = await app.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: oldPassword }),
  });
  assertEquals(oldLoginRes.status, 401);

  const newLoginRes = await app.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: newPassword }),
  });
  assertEquals(newLoginRes.status, 200);
});

Deno.test("POST /forgot-password responde 200 aunque el email no exista", async () => {
  const { app } = createTestApp();
  const res = await app.request("/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: uniqueEmail() }),
  });
  assertEquals(res.status, 200);
});

Deno.test("POST /register responde 201 y crea el usuario aunque el envío del email de verificación falle", async () => {
  const email = uniqueEmail();
  const app = createAuthRoutes({
    sendVerificationEmail: () => {
      throw new Error("network down");
    },
    sendPasswordResetEmail: () => Promise.resolve(),
  });

  const res = await app.request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });

  assertEquals(res.status, 201);
  const body = await res.json();
  assertExists(body.id);
});

Deno.test("POST /forgot-password responde 200 para un email existente aunque el envío del email falle", async () => {
  const email = uniqueEmail();
  const app = createAuthRoutes({
    sendVerificationEmail: () => Promise.resolve(),
    sendPasswordResetEmail: () => {
      throw new Error("network down");
    },
  });

  await app.request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });

  const res = await app.request("/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  assertEquals(res.status, 200);
});

Deno.test("POST /reset-password con token inválido responde 400", async () => {
  const { app } = createTestApp();
  const res = await app.request("/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "not-a-real-token", newPassword: "newpassword123" }),
  });
  assertEquals(res.status, 400);
});
