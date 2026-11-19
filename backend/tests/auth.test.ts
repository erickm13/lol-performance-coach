import "./test_setup.ts";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";
import { sign } from "jsr:@hono/hono@^4.6.0/jwt";
import { createAuthRoutes } from "../src/routes/auth.ts";

// Test addresses use example.com, whose real null MX accepts no mail.
const acceptsMail = () => Promise.resolve([{ exchange: "mx.example.com." }]);

function createTestApp(resolveMx = acceptsMail) {
  const sentEmails: { to: string; token: string; kind: "verify" | "reset" }[] = [];
  const app = createAuthRoutes({
    resolveMx,
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
    resolveMx: acceptsMail,
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
    resolveMx: acceptsMail,
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

function register(app: ReturnType<typeof createAuthRoutes>, email: string) {
  return app.request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
}

Deno.test("POST /register rechaza correos con formato inválido", async () => {
  const { app, sentEmails } = createTestApp();
  for (const email of ["sin-arroba.com", "a@b", "a b@example.com", "a@-x.com"]) {
    const res = await register(app, email);
    assertEquals(res.status, 400, email);
  }
  assertEquals(sentEmails.length, 0);
});

Deno.test("POST /register rechaza dominios que no reciben correo", async () => {
  const noRecords = () => Promise.reject(new Deno.errors.NotFound("no records"));
  const nullMx = () => Promise.resolve([{ exchange: "." }]);
  for (const resolveMx of [noRecords, nullMx]) {
    const { app, sentEmails } = createTestApp(resolveMx);
    const res = await register(app, uniqueEmail());
    assertEquals(res.status, 400);
    assertEquals((await res.json()).error.includes("no puede recibir correos"), true);
    assertEquals(sentEmails.length, 0);
  }
});

Deno.test("POST /register no bloquea el registro si falla el DNS", async () => {
  const { app } = createTestApp(() => Promise.reject(new Error("timeout")));
  const res = await register(app, uniqueEmail());
  assertEquals(res.status, 201);
});

Deno.test("el correo se normaliza: registro y login ignoran espacios y mayúsculas", async () => {
  const { app, sentEmails } = createTestApp();
  const email = uniqueEmail();
  const res = await register(app, `  ${email.toUpperCase()} `);
  assertEquals(res.status, 201);
  assertEquals((await res.json()).email, email);
  assertEquals(sentEmails[0].to, email);

  const duplicate = await register(app, email);
  assertEquals(duplicate.status, 409);

  const login = await app.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.toUpperCase(), password: "password123" }),
  });
  assertEquals(login.status, 200);
});

Deno.test("el aviso legal se registra una sola vez por cuenta", async () => {
  const { app, sentEmails } = createTestApp();
  const email = uniqueEmail();
  await register(app, email);
  await app.request("/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: sentEmails[0].token }),
  });
  const login = await app.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  const cookie = extractSessionCookie(login);

  const before = await (await app.request("/me", { headers: { Cookie: cookie } })).json();
  assertEquals(before.legalNoticeAcceptedAt, null);

  const first = await app.request("/legal-notice", { method: "POST", headers: { Cookie: cookie } });
  assertEquals(first.status, 200);
  const { legalNoticeAcceptedAt } = await first.json();
  assertExists(legalNoticeAcceptedAt);

  const again = await (await app.request("/legal-notice", { method: "POST", headers: { Cookie: cookie } })).json();
  assertEquals(again.legalNoticeAcceptedAt, legalNoticeAcceptedAt);

  const after = await (await app.request("/me", { headers: { Cookie: cookie } })).json();
  assertEquals(after.legalNoticeAcceptedAt, legalNoticeAcceptedAt);
});

Deno.test("POST /legal-notice sin sesión responde 401", async () => {
  const { app } = createTestApp();
  const res = await app.request("/legal-notice", { method: "POST" });
  assertEquals(res.status, 401);
});
