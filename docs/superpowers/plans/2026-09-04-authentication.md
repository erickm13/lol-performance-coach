# Autenticación (registro, login, verificación de email, recuperación de contraseña) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el flujo completo de autenticación por email/contraseña — registro, login, logout, verificación de email y recuperación de contraseña — sobre el walking skeleton ya existente.

**Architecture:** Backend: módulos aislados para hashing (`bcryptjs`), sesión (JWT vía `hono/jwt` en cookie httpOnly), tokens de un solo uso (`auth_tokens`), y envío de email (Resend, inyectado por dependencia para que las rutas sean testeables sin red). Rutas montadas en `/auth/*` sobre el `app` de Hono existente. Frontend: un componente + página por pantalla (login, registro, verificar email, olvidé mi contraseña, restablecer contraseña, dashboard placeholder protegido), siguiendo el mismo patrón que `HealthStatus.tsx`.

**Tech Stack:** `bcryptjs` ^2.4.3, `hono/jwt` + `hono/cookie` (ya incluidos en `jsr:@hono/hono@^4.6.0`), `resend` ^4.0.0, `jsr:@std/encoding@^1.0.0` (tokens random), Drizzle ORM (ya en el proyecto), Next.js App Router (ya en el proyecto).

**Spec:** `docs/superpowers/specs/2026-09-04-authentication-design.md`

## Global Constraints

- Sesión: JWT en cookie `httpOnly`, `sameSite=Lax`, `secure` solo si `Deno.env.get("DENO_ENV") === "production"`, expira a las 2 horas (`60 * 60 * 2` segundos), sin renovación automática.
- Hash de contraseñas: `bcryptjs`, no `bcrypt` nativo (evita problemas de compilación en Docker Alpine ya vistos en este proyecto).
- Contraseña mínima: 8 caracteres (validado en el backend, única fuente de verdad).
- Tokens de `auth_tokens`: random de 32 bytes, codificados en base64url (`jsr:@std/encoding@^1.0.0/base64url`). Al generar uno nuevo de un `type` para un `user_id`, se marcan `used_at = now()` los anteriores del mismo `type`/usuario que sigan sin usar.
- `POST /auth/forgot-password` responde 200 exista o no el email — nunca revela si un email está registrado.
- `POST /auth/login` NO bloquea el acceso si `email_verified=false` — solo informa `emailVerified` en la respuesta.
- Envío de email: Resend, remitente `onboarding@resend.dev`. Las rutas reciben las funciones de envío por inyección de dependencia (`AuthEmailDeps`) para que los tests no dependan de la red.
- CORS: origen explícito (`Deno.env.get("FRONTEND_URL") ?? "http://localhost:3000"`) + `credentials: true` — ya no `cors()` sin argumentos.
- Todas las rutas nuevas van bajo prefijo `/auth`.

---

### Task 1: Esquema — `users.email_verified` + tabla `auth_tokens`

**Files:**
- Modify: `backend/src/db/schema.ts`
- Modify: `backend/tests/schema.test.ts`
- Modify: `backend/tests/db.test.ts`
- Modify: `docs/modelo-entidad-relacion.md`

**Interfaces:**
- Produces: `backend/src/db/schema.ts` exporta `authTokens` (`pgTable`) y `users` ahora incluye `emailVerified`. Tasks posteriores (4, 6) importan `authTokens` y `users` desde este módulo.

- [ ] **Step 1: Confirmar que Postgres está corriendo**

```bash
docker ps --filter name=scaffolding-postgres --format '{{.Names}}'
```

Si no aparece nada, levantarlo:

```bash
docker compose up -d postgres
```

Exportar la variable que van a usar los siguientes comandos (ajustar el puerto si tu `docker-compose.yml` publica otro):

```bash
export DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5433/lol_analytics
```

- [ ] **Step 2: Escribir el test que falla — actualizar `backend/tests/schema.test.ts`**

```typescript
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { getTableName } from "npm:drizzle-orm@^0.36.0";
import {
  users,
  riotAccounts,
  ingestionJobs,
  matches,
  matchParticipants,
  matchMetrics,
  weaknesses,
  trainingPlans,
  trainingPlanItems,
  planProgress,
  authTokens,
} from "../src/db/schema.ts";

Deno.test("el esquema exporta las 10 tablas del MER con el nombre correcto", () => {
  assertEquals(getTableName(users), "users");
  assertEquals(getTableName(riotAccounts), "riot_accounts");
  assertEquals(getTableName(ingestionJobs), "ingestion_jobs");
  assertEquals(getTableName(matches), "matches");
  assertEquals(getTableName(matchParticipants), "match_participants");
  assertEquals(getTableName(matchMetrics), "match_metrics");
  assertEquals(getTableName(weaknesses), "weaknesses");
  assertEquals(getTableName(trainingPlans), "training_plans");
  assertEquals(getTableName(trainingPlanItems), "training_plan_items");
  assertEquals(getTableName(planProgress), "plan_progress");
});

Deno.test("el esquema exporta la tabla auth_tokens", () => {
  assertEquals(getTableName(authTokens), "auth_tokens");
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `cd backend && deno test -A tests/schema.test.ts`
Expected: FAIL — no se puede resolver el nombre `authTokens` (todavía no existe).

- [ ] **Step 4: Modificar `backend/src/db/schema.ts`**

Agregar la columna `emailVerified` a `users`:

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Agregar la tabla nueva al final del archivo:

```typescript
export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `deno test -A tests/schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Actualizar `backend/tests/db.test.ts` para incluir la tabla nueva**

```typescript
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import postgres from "npm:postgres@^3.4.4";
import { runMigrations } from "../src/db/migrate.ts";

Deno.test("runMigrations crea las 11 tablas del modelo entidad-relación", async () => {
  await runMigrations();

  const connectionString = Deno.env.get("DATABASE_URL")!;
  const sql = postgres(connectionString);
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `;
  const tableNames = rows.map((row) => row.table_name);

  assertEquals(tableNames, [
    "auth_tokens",
    "ingestion_jobs",
    "match_metrics",
    "match_participants",
    "matches",
    "plan_progress",
    "riot_accounts",
    "training_plan_items",
    "training_plans",
    "users",
    "weaknesses",
  ]);

  await sql.end();
});
```

- [ ] **Step 7: Generar la migración SQL a partir del esquema**

Run: `deno task db:generate`
Expected: crea un nuevo archivo `.sql` en `backend/src/db/migrations/` con el `ALTER TABLE users` y el `CREATE TABLE auth_tokens`.

- [ ] **Step 8: Correr el test y confirmar que pasa**

Run: `deno test -A tests/db.test.ts`
Expected: PASS (1 test).

- [ ] **Step 9: Actualizar `docs/modelo-entidad-relacion.md`**

En el bloque `erDiagram`, agregar la relación (después de la línea `users ||--o{ riot_accounts : "vincula"`):

```
    users ||--o{ auth_tokens : "genera"
```

En el bloque `users { ... }`, agregar el campo nuevo (después de `text password_hash`):

```
        boolean email_verified
```

Agregar el bloque de la entidad nueva (después del bloque `users { ... }`):

```
    auth_tokens {
        uuid id PK
        uuid user_id FK
        text type "email_verification|password_reset"
        text token UK
        timestamptz expires_at
        timestamptz used_at "nullable, null = sin usar"
        timestamptz created_at
    }
```

En "Diccionario de datos", agregar la fila a la tabla de `users`:

```
| email_verified | boolean | Si confirmó su email vía el link de verificación |
```

Y agregar una sección nueva después de la sección `### users`:

```markdown
### `auth_tokens`
Tokens de un solo uso para verificación de email y recuperación de contraseña. Al generar uno nuevo de un `type` para un usuario, se invalidan (`used_at = now()`) los anteriores del mismo `type` que sigan sin usar.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid, PK | Identificador interno |
| user_id | uuid, FK → users.id | Dueño del token |
| type | text | `email_verification` \| `password_reset` |
| token | text, único | Valor random enviado por email |
| expires_at | timestamptz | A partir de cuándo deja de ser válido |
| used_at | timestamptz, nullable | Cuándo se consumió (null = todavía válido) |
| created_at | timestamptz | Cuándo se generó |
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/db/schema.ts backend/tests/schema.test.ts backend/tests/db.test.ts backend/src/db/migrations docs/modelo-entidad-relacion.md
git commit -m "feat(backend): add users.email_verified and auth_tokens table"
```

---

### Task 2: Módulo de hashing de contraseñas

**Files:**
- Create: `backend/src/auth/password.ts`
- Test: `backend/tests/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>` y `verifyPassword(password: string, hash: string): Promise<boolean>` desde `backend/src/auth/password.ts`. La Task 6 los usa.

- [ ] **Step 1: Escribir el test que falla — `backend/tests/password.test.ts`**

```typescript
import { assertEquals, assertNotEquals } from "jsr:@std/assert@^1.0.0";
import { hashPassword, verifyPassword } from "../src/auth/password.ts";

Deno.test("hashPassword produce un hash distinto del texto plano", async () => {
  const hash = await hashPassword("password123");
  assertNotEquals(hash, "password123");
});

Deno.test("verifyPassword devuelve true para la contraseña correcta", async () => {
  const hash = await hashPassword("password123");
  const result = await verifyPassword("password123", hash);
  assertEquals(result, true);
});

Deno.test("verifyPassword devuelve false para una contraseña incorrecta", async () => {
  const hash = await hashPassword("password123");
  const result = await verifyPassword("wrongpassword", hash);
  assertEquals(result, false);
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd backend && deno test -A tests/password.test.ts`
Expected: FAIL — no se puede resolver `../src/auth/password.ts`.

- [ ] **Step 3: Implementar `backend/src/auth/password.ts`**

```typescript
import bcrypt from "npm:bcryptjs@^2.4.3";

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `deno test -A tests/password.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/password.ts backend/tests/password.test.ts
git commit -m "feat(backend): add password hashing module (bcryptjs)"
```

---

### Task 3: Módulo de sesión (JWT)

**Files:**
- Create: `backend/src/auth/jwt.ts`
- Test: `backend/tests/jwt.test.ts`
- Modify: `.env.example`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `signSessionToken(userId: string): Promise<string>` y `verifySessionToken(token: string): Promise<string | null>` desde `backend/src/auth/jwt.ts`. La Task 6 los usa.

- [ ] **Step 1: Agregar `JWT_SECRET` a `.env.example`**

```
JWT_SECRET=
```

(agregarlo al final del archivo existente, junto a las otras variables)

- [ ] **Step 2: Agregar `JWT_SECRET` al job `backend` de CI — `.github/workflows/ci.yml`**

En el bloque `env:` del job `backend` (que hoy solo tiene `DATABASE_URL`), agregar:

```yaml
    env:
      DATABASE_URL: postgres://lol_analytics:lol_analytics@localhost:5432/lol_analytics
      JWT_SECRET: test-secret-not-for-production
```

- [ ] **Step 3: Exportar `JWT_SECRET` localmente para poder correr los tests**

```bash
export JWT_SECRET=un-secreto-de-desarrollo-cualquiera
```

- [ ] **Step 4: Escribir el test que falla — `backend/tests/jwt.test.ts`**

```typescript
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { sign } from "jsr:@hono/hono@^4.6.0/jwt";
import { signSessionToken, verifySessionToken } from "../src/auth/jwt.ts";

Deno.test("signSessionToken y verifySessionToken hacen round-trip del id de usuario", async () => {
  const userId = crypto.randomUUID();
  const token = await signSessionToken(userId);
  const result = await verifySessionToken(token);
  assertEquals(result, userId);
});

Deno.test("verifySessionToken devuelve null con un token inválido", async () => {
  const result = await verifySessionToken("token-invalido");
  assertEquals(result, null);
});

Deno.test("verifySessionToken devuelve null con un token expirado", async () => {
  const secret = Deno.env.get("JWT_SECRET")!;
  const expiredToken = await sign(
    { sub: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) - 10 },
    secret,
  );

  const result = await verifySessionToken(expiredToken);
  assertEquals(result, null);
});
```

- [ ] **Step 5: Correr el test y confirmar que falla**

Run: `cd backend && deno test -A tests/jwt.test.ts`
Expected: FAIL — no se puede resolver `../src/auth/jwt.ts`.

- [ ] **Step 6: Implementar `backend/src/auth/jwt.ts`**

```typescript
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
    const payload = await verify(token, getSecret());
    return payload.sub as string;
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Correr el test y confirmar que pasa**

Run: `deno test -A tests/jwt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/src/auth/jwt.ts backend/tests/jwt.test.ts .env.example .github/workflows/ci.yml
git commit -m "feat(backend): add JWT session module"
```

---

### Task 4: Módulo de tokens de un solo uso (`auth_tokens`)

**Files:**
- Create: `backend/src/auth/tokens.ts`
- Test: `backend/tests/tokens.test.ts`

**Interfaces:**
- Consumes: `authTokens`, `users` desde `backend/src/db/schema.ts` (Task 1); `db` desde `backend/src/db/client.ts`.
- Produces: `AuthTokenType` (`"email_verification" | "password_reset"`), `createAuthToken(userId: string, type: AuthTokenType): Promise<string>`, `consumeAuthToken(token: string, type: AuthTokenType): Promise<string | null>` desde `backend/src/auth/tokens.ts`. La Task 6 los usa.

- [ ] **Step 1: Escribir el test que falla — `backend/tests/tokens.test.ts`**

```typescript
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { db } from "../src/db/client.ts";
import { users, authTokens } from "../src/db/schema.ts";
import { createAuthToken, consumeAuthToken } from "../src/auth/tokens.ts";

async function createTestUser(): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${crypto.randomUUID()}@example.com`,
      passwordHash: "irrelevant-for-this-test",
    })
    .returning();
  return user.id;
}

Deno.test("createAuthToken y consumeAuthToken hacen round-trip del user id", async () => {
  const userId = await createTestUser();
  const token = await createAuthToken(userId, "email_verification");

  const result = await consumeAuthToken(token, "email_verification");
  assertEquals(result, userId);
});

Deno.test("consumeAuthToken devuelve null si el token ya fue usado", async () => {
  const userId = await createTestUser();
  const token = await createAuthToken(userId, "email_verification");

  await consumeAuthToken(token, "email_verification");
  const secondAttempt = await consumeAuthToken(token, "email_verification");

  assertEquals(secondAttempt, null);
});

Deno.test("consumeAuthToken devuelve null con un token inexistente", async () => {
  const result = await consumeAuthToken(
    "token-que-no-existe",
    "email_verification",
  );
  assertEquals(result, null);
});

Deno.test("createAuthToken invalida tokens previos sin usar del mismo tipo y usuario", async () => {
  const userId = await createTestUser();
  const firstToken = await createAuthToken(userId, "password_reset");
  const secondToken = await createAuthToken(userId, "password_reset");

  const firstAttempt = await consumeAuthToken(firstToken, "password_reset");
  assertEquals(firstAttempt, null);

  const secondAttempt = await consumeAuthToken(secondToken, "password_reset");
  assertEquals(secondAttempt, userId);
});

Deno.test("consumeAuthToken devuelve null si el token ya expiró", async () => {
  const userId = await createTestUser();
  const [row] = await db
    .insert(authTokens)
    .values({
      userId,
      type: "password_reset",
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() - 1000),
    })
    .returning();

  const result = await consumeAuthToken(row.token, "password_reset");
  assertEquals(result, null);
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd backend && deno test -A tests/tokens.test.ts`
Expected: FAIL — no se puede resolver `../src/auth/tokens.ts`.

- [ ] **Step 3: Implementar `backend/src/auth/tokens.ts`**

```typescript
import { encodeBase64Url } from "jsr:@std/encoding@^1.0.0/base64url";
import { and, eq, isNull } from "npm:drizzle-orm@^0.36.0";
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
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.token, token),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
      ),
    )
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, row.id));

  return row.userId;
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `deno test -A tests/tokens.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/tokens.ts backend/tests/tokens.test.ts
git commit -m "feat(backend): add single-use auth token module"
```

---

### Task 5: Módulo de envío de email (Resend)

**Files:**
- Create: `backend/src/email/resend.ts`
- Test: `backend/tests/resend.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `sendVerificationEmail(to: string, token: string): Promise<void>` y `sendPasswordResetEmail(to: string, token: string): Promise<void>` desde `backend/src/email/resend.ts`. La Task 6 los usa como implementación real (inyectada en `app.ts`); los tests de la Task 6 usan versiones falsas en su lugar.

- [ ] **Step 1: Agregar variables a `.env.example`**

```
RESEND_API_KEY=
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 2: Escribir el test que falla — `backend/tests/resend.test.ts`**

```typescript
import { assertRejects } from "jsr:@std/assert@^1.0.0";
import { sendVerificationEmail } from "../src/email/resend.ts";

Deno.test("sendVerificationEmail lanza un error si RESEND_API_KEY no está configurada", async () => {
  const previous = Deno.env.get("RESEND_API_KEY");
  Deno.env.delete("RESEND_API_KEY");

  try {
    await assertRejects(() => sendVerificationEmail("test@example.com", "token123"));
  } finally {
    if (previous !== undefined) {
      Deno.env.set("RESEND_API_KEY", previous);
    }
  }
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `cd backend && deno test -A tests/resend.test.ts`
Expected: FAIL — no se puede resolver `../src/email/resend.ts`.

- [ ] **Step 4: Implementar `backend/src/email/resend.ts`**

```typescript
import { Resend } from "npm:resend@^4.0.0";

function getClient(): Resend {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("La variable de entorno RESEND_API_KEY es requerida");
  }
  return new Resend(apiKey);
}

function getFrontendUrl(): string {
  return Deno.env.get("FRONTEND_URL") ?? "http://localhost:3000";
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const resend = getClient();
  const link = `${getFrontendUrl()}/verify-email?token=${token}`;
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to,
    subject: "Verificá tu cuenta",
    html: `<p>Hacé click para verificar tu cuenta: <a href="${link}">${link}</a></p>`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const resend = getClient();
  const link = `${getFrontendUrl()}/reset-password?token=${token}`;
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to,
    subject: "Recuperá tu contraseña",
    html: `<p>Hacé click para restablecer tu contraseña: <a href="${link}">${link}</a></p>`,
  });
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `deno test -A tests/resend.test.ts`
Expected: PASS (1 test). No requiere `RESEND_API_KEY` real ni red — el test explícitamente la borra.

- [ ] **Step 6: Commit**

```bash
git add backend/src/email/resend.ts backend/tests/resend.test.ts .env.example
git commit -m "feat(backend): add Resend email module"
```

---

### Task 6: Rutas de `/auth/*` + CORS con credenciales

**Files:**
- Create: `backend/src/routes/auth.ts`
- Test: `backend/tests/auth.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/health.test.ts`

**Interfaces:**
- Consumes: `hashPassword`/`verifyPassword` (Task 2), `signSessionToken`/`verifySessionToken` (Task 3), `createAuthToken`/`consumeAuthToken`/`AuthTokenType` (Task 4), `sendVerificationEmail`/`sendPasswordResetEmail` (Task 5), `db`/`users` (existentes).
- Produces: `createAuthRoutes(deps: AuthEmailDeps): Hono` y el tipo `AuthEmailDeps` desde `backend/src/routes/auth.ts`. `app.ts` lo monta con las implementaciones reales; los tests lo instancian con funciones falsas.

- [ ] **Step 1: Escribir los tests que fallan — `backend/tests/auth.test.ts`**

```typescript
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";
import { sign } from "jsr:@hono/hono@^4.6.0/jwt";
import { createAuthRoutes } from "../src/routes/auth.ts";

function createTestApp() {
  const sentEmails: { to: string; token: string; kind: "verify" | "reset" }[] = [];
  const app = createAuthRoutes({
    sendVerificationEmail: async (to, token) => {
      sentEmails.push({ to, token, kind: "verify" });
    },
    sendPasswordResetEmail: async (to, token) => {
      sentEmails.push({ to, token, kind: "reset" });
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

Deno.test("POST /reset-password con token inválido responde 400", async () => {
  const { app } = createTestApp();
  const res = await app.request("/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "not-a-real-token", newPassword: "newpassword123" }),
  });
  assertEquals(res.status, 400);
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `cd backend && deno test -A tests/auth.test.ts`
Expected: FAIL — no se puede resolver `../src/routes/auth.ts`.

- [ ] **Step 3: Implementar `backend/src/routes/auth.ts`**

```typescript
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
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `deno test -A tests/auth.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Montar las rutas y actualizar CORS en `backend/src/app.ts`**

```typescript
import { Hono } from "jsr:@hono/hono@^4.6.0";
import { cors } from "jsr:@hono/hono@^4.6.0/cors";
import { db } from "./db/client.ts";
import { sql } from "npm:drizzle-orm@^0.36.0";
import { createAuthRoutes } from "./routes/auth.ts";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email/resend.ts";

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: Deno.env.get("FRONTEND_URL") ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.route("/auth", createAuthRoutes({ sendVerificationEmail, sendPasswordResetEmail }));

app.get("/health", async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ status: "ok", db: "connected" });
  } catch (error) {
    return c.json(
      { status: "error", db: "disconnected", message: String(error) },
      503,
    );
  }
});
```

- [ ] **Step 6: Actualizar la aserción de CORS en `backend/tests/health.test.ts`**

El origen ya no es `*` sino el explícito. Reemplazar la última aserción:

```typescript
Deno.test("GET /health incluye cabeceras CORS para que el frontend pueda consumirlo", async () => {
  const res = await app.request("/health", {
    headers: { Origin: "http://localhost:3000" },
  });

  assertEquals(
    res.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );
});
```

- [ ] **Step 7: Correr toda la suite del backend y confirmar que pasa**

Run: `deno task test`
Expected: PASS (todos los tests: schema, db, health, password, jwt, tokens, resend, auth).

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/auth.ts backend/tests/auth.test.ts backend/src/app.ts backend/tests/health.test.ts
git commit -m "feat(backend): add /auth/* routes and restrict CORS to the frontend origin"
```

---

### Task 7: Frontend — helper de API + página de login

**Files:**
- Create: `frontend/app/lib/api.ts`
- Create: `frontend/app/components/LoginForm.tsx`
- Create: `frontend/app/login/page.tsx`
- Test: `frontend/tests/LoginForm.test.tsx`

**Interfaces:**
- Produces: `getBackendUrl(): string` desde `frontend/app/lib/api.ts` — usado por todas las tasks de frontend siguientes (8-12).
- Produces: `LoginForm` (export nombrado) desde `frontend/app/components/LoginForm.tsx`.

- [ ] **Step 1: Crear `frontend/app/lib/api.ts`**

```typescript
export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
}
```

- [ ] **Step 2: Escribir el test que falla — `frontend/tests/LoginForm.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginForm } from "../app/components/LoginForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("hace login y redirige a /dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: "1", email: "a@b.com", emailVerified: true }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("muestra un error si las credenciales son inválidas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Credenciales inválidas" }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/credenciales inválidas/i),
    );
  });
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `cd frontend && npm test` (o `npx vitest run tests/LoginForm.test.tsx`)
Expected: FAIL — no se puede resolver `../app/components/LoginForm`.

- [ ] **Step 4: Implementar `frontend/app/components/LoginForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`${getBackendUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "No se pudo iniciar sesión");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Contraseña
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white rounded px-3 py-2"
      >
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
      <a href="/forgot-password" className="text-sm underline">
        ¿Olvidaste tu contraseña?
      </a>
      <a href="/register" className="text-sm underline">
        ¿No tenés cuenta? Registrate
      </a>
    </form>
  );
}
```

- [ ] **Step 5: Crear `frontend/app/login/page.tsx`**

```tsx
import { LoginForm } from "../components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/app/lib/api.ts frontend/app/components/LoginForm.tsx frontend/app/login/page.tsx frontend/tests/LoginForm.test.tsx
git commit -m "feat(frontend): add login page"
```

---

### Task 8: Frontend — página de registro

**Files:**
- Create: `frontend/app/components/RegisterForm.tsx`
- Create: `frontend/app/register/page.tsx`
- Test: `frontend/tests/RegisterForm.test.tsx`

**Interfaces:**
- Consumes: `getBackendUrl` desde `frontend/app/lib/api.ts` (Task 7).

- [ ] **Step 1: Escribir el test que falla — `frontend/tests/RegisterForm.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RegisterForm } from "../app/components/RegisterForm";

describe("RegisterForm", () => {
  it("registra y muestra el mensaje de verificación", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "1", email: "a@b.com" }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() =>
      expect(screen.getByText(/revisá tu correo/i)).toBeInTheDocument(),
    );
  });

  it("muestra error si las contraseñas no coinciden", async () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd frontend && npm test`
Expected: FAIL — no se puede resolver `../app/components/RegisterForm`.

- [ ] **Step 3: Implementar `frontend/app/components/RegisterForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { getBackendUrl } from "../lib/api";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSubmitting(true);
    const res = await fetch(`${getBackendUrl()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "No se pudo completar el registro");
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return <p>Revisá tu correo para verificar tu cuenta.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Crear cuenta</h1>
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Contraseña
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Confirmar contraseña
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white rounded px-3 py-2"
      >
        {submitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>
      <a href="/login" className="text-sm underline">
        ¿Ya tenés cuenta? Iniciá sesión
      </a>
    </form>
  );
}
```

- [ ] **Step 4: Crear `frontend/app/register/page.tsx`**

```tsx
import { RegisterForm } from "../components/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <RegisterForm />
    </main>
  );
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/components/RegisterForm.tsx frontend/app/register/page.tsx frontend/tests/RegisterForm.test.tsx
git commit -m "feat(frontend): add register page"
```

---

### Task 9: Frontend — página de verificación de email

**Files:**
- Create: `frontend/app/components/VerifyEmailStatus.tsx`
- Create: `frontend/app/verify-email/page.tsx`
- Test: `frontend/tests/VerifyEmailStatus.test.tsx`

**Interfaces:**
- Consumes: `getBackendUrl` desde `frontend/app/lib/api.ts` (Task 7).

- [ ] **Step 1: Escribir el test que falla — `frontend/tests/VerifyEmailStatus.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VerifyEmailStatus } from "../app/components/VerifyEmailStatus";

describe("VerifyEmailStatus", () => {
  it("muestra éxito cuando el backend confirma el token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true })) as unknown as typeof fetch,
    );

    render(<VerifyEmailStatus token="abc123" />);
    expect(screen.getByText(/verificando/i)).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText(/quedó verificado/i)).toBeInTheDocument(),
    );
  });

  it("muestra error cuando no hay token", async () => {
    render(<VerifyEmailStatus token={null} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd frontend && npm test`
Expected: FAIL — no se puede resolver `../app/components/VerifyEmailStatus`.

- [ ] **Step 3: Implementar `frontend/app/components/VerifyEmailStatus.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "../lib/api";

export function VerifyEmailStatus({ token }: { token: string | null }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch(`${getBackendUrl()}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => setStatus(res.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "loading") return <p>Verificando tu email...</p>;
  if (status === "success") {
    return <p>¡Tu email quedó verificado! Ya podés iniciar sesión.</p>;
  }
  return (
    <p role="alert">
      No pudimos verificar tu email. El link puede haber expirado.
    </p>
  );
}
```

- [ ] **Step 4: Crear `frontend/app/verify-email/page.tsx`**

`useSearchParams` requiere un límite `<Suspense>` en el App Router de Next.js.

```tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VerifyEmailStatus } from "../components/VerifyEmailStatus";

function VerifyEmailContent() {
  const params = useSearchParams();
  return <VerifyEmailStatus token={params.get("token")} />;
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <Suspense fallback={<p>Cargando...</p>}>
        <VerifyEmailContent />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/components/VerifyEmailStatus.tsx frontend/app/verify-email/page.tsx frontend/tests/VerifyEmailStatus.test.tsx
git commit -m "feat(frontend): add email verification page"
```

---

### Task 10: Frontend — página de "olvidé mi contraseña"

**Files:**
- Create: `frontend/app/components/ForgotPasswordForm.tsx`
- Create: `frontend/app/forgot-password/page.tsx`
- Test: `frontend/tests/ForgotPasswordForm.test.tsx`

**Interfaces:**
- Consumes: `getBackendUrl` desde `frontend/app/lib/api.ts` (Task 7).

- [ ] **Step 1: Escribir el test que falla — `frontend/tests/ForgotPasswordForm.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ForgotPasswordForm } from "../app/components/ForgotPasswordForm";

describe("ForgotPasswordForm", () => {
  it("envía la solicitud y muestra la confirmación genérica", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
      ) as unknown as typeof fetch,
    );

    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() =>
      expect(screen.getByText(/si el email existe/i)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd frontend && npm test`
Expected: FAIL — no se puede resolver `../app/components/ForgotPasswordForm`.

- [ ] **Step 3: Implementar `frontend/app/components/ForgotPasswordForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { getBackendUrl } from "../lib/api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${getBackendUrl()}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSubmitted(true);
  }

  if (submitted) {
    return <p>Si el email existe, te enviamos un link para recuperar tu contraseña.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
      <label className="flex flex-col gap-1">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <button type="submit" className="bg-blue-600 text-white rounded px-3 py-2">
        Enviar link
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Crear `frontend/app/forgot-password/page.tsx`**

```tsx
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <ForgotPasswordForm />
    </main>
  );
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/components/ForgotPasswordForm.tsx frontend/app/forgot-password/page.tsx frontend/tests/ForgotPasswordForm.test.tsx
git commit -m "feat(frontend): add forgot-password page"
```

---

### Task 11: Frontend — página de restablecer contraseña

**Files:**
- Create: `frontend/app/components/ResetPasswordForm.tsx`
- Create: `frontend/app/reset-password/page.tsx`
- Test: `frontend/tests/ResetPasswordForm.test.tsx`

**Interfaces:**
- Consumes: `getBackendUrl` desde `frontend/app/lib/api.ts` (Task 7).

- [ ] **Step 1: Escribir el test que falla — `frontend/tests/ResetPasswordForm.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ResetPasswordForm } from "../app/components/ResetPasswordForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("ResetPasswordForm", () => {
  it("restablece la contraseña y redirige a /login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
      ) as unknown as typeof fetch,
    );

    render(<ResetPasswordForm token="abc123" />);
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar nueva contraseña/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });

  it("muestra error si el token es null", async () => {
    render(<ResetPasswordForm token={null} />);
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar nueva contraseña/i }));

    expect(await screen.findByText(/link inválido/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd frontend && npm test`
Expected: FAIL — no se puede resolver `../app/components/ResetPasswordForm`.

- [ ] **Step 3: Implementar `frontend/app/components/ResetPasswordForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Link inválido");
      return;
    }

    setSubmitting(true);
    const res = await fetch(`${getBackendUrl()}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "No se pudo restablecer la contraseña");
      return;
    }

    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1">
        Nueva contraseña
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white rounded px-3 py-2"
      >
        {submitting ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Crear `frontend/app/reset-password/page.tsx`**

```tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "../components/ResetPasswordForm";

function ResetPasswordContent() {
  const params = useSearchParams();
  return <ResetPasswordForm token={params.get("token")} />;
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <Suspense fallback={<p>Cargando...</p>}>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/components/ResetPasswordForm.tsx frontend/app/reset-password/page.tsx frontend/tests/ResetPasswordForm.test.tsx
git commit -m "feat(frontend): add reset-password page"
```

---

### Task 12: Frontend — dashboard protegido (placeholder)

**Files:**
- Create: `frontend/app/components/DashboardContent.tsx`
- Create: `frontend/app/dashboard/page.tsx`
- Test: `frontend/tests/DashboardContent.test.tsx`

**Interfaces:**
- Consumes: `getBackendUrl` desde `frontend/app/lib/api.ts` (Task 7).

- [ ] **Step 1: Escribir el test que falla — `frontend/tests/DashboardContent.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardContent } from "../app/components/DashboardContent";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("DashboardContent", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("muestra el email del usuario logueado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: "1", email: "a@b.com", emailVerified: true }),
        }),
      ) as unknown as typeof fetch,
    );

    render(<DashboardContent />);
    await waitFor(() =>
      expect(screen.getByText(/hola, a@b.com/i)).toBeInTheDocument(),
    );
  });

  it("redirige a /login si no hay sesión activa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false })) as unknown as typeof fetch,
    );

    render(<DashboardContent />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd frontend && npm test`
Expected: FAIL — no se puede resolver `../app/components/DashboardContent`.

- [ ] **Step 3: Implementar `frontend/app/components/DashboardContent.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "../lib/api";

type Me = { id: string; email: string; emailVerified: boolean };

export function DashboardContent() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch(`${getBackendUrl()}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setMe(data);
      });
  }, [router]);

  async function handleLogout() {
    await fetch(`${getBackendUrl()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
  }

  if (!me) return <p>Cargando...</p>;

  return (
    <div className="flex flex-col gap-4 items-center">
      <p>Hola, {me.email}</p>
      {!me.emailVerified && (
        <p role="alert">Todavía no verificaste tu email.</p>
      )}
      <button
        onClick={handleLogout}
        className="bg-blue-600 text-white rounded px-3 py-2"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Crear `frontend/app/dashboard/page.tsx`**

```tsx
import { DashboardContent } from "../components/DashboardContent";

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <DashboardContent />
    </main>
  );
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/components/DashboardContent.tsx frontend/app/dashboard/page.tsx frontend/tests/DashboardContent.test.tsx
git commit -m "feat(frontend): add protected dashboard placeholder"
```

---

### Task 13: Wiring de Docker Compose y verificación final de punta a punta

**Files:**
- Modify: `docker-compose.yml`

**Interfaces:**
- Ninguna — tarea de integración y verificación final, no agrega código nuevo.

- [ ] **Step 1: Agregar las variables nuevas al servicio `backend` en `docker-compose.yml`**

```yaml
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://lol_analytics:lol_analytics@postgres:5432/lol_analytics
      PORT: "8000"
      JWT_SECRET: ${JWT_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      FRONTEND_URL: http://localhost:3000
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
```

(Docker Compose sustituye `${JWT_SECRET}` y `${RESEND_API_KEY}` automáticamente desde el archivo `.env` de la raíz del repo — el mismo que ya se usa para las otras variables.)

- [ ] **Step 2: Completar el `.env` local con valores reales**

```bash
cp .env.example .env  # si no existe ya
```

Editar `.env` y completar `JWT_SECRET` (cualquier string largo random) y `RESEND_API_KEY` (la key real de la cuenta de Resend).

- [ ] **Step 3: Levantar el stack completo**

```bash
docker compose up -d --build
docker compose ps
```

Expected: los 4 servicios (`postgres`, `redis`, `backend`, `frontend`) en estado `Up`/`running`/`healthy`.

- [ ] **Step 4: Verificación manual de punta a punta**

Con el navegador en `http://localhost:3000`:

1. Ir a `/register`, crear una cuenta con un email real al que tengas acceso.
2. Confirmar que llega el correo de verificación (desde Resend) y que el link apunta a `/verify-email?token=...`.
3. Abrir ese link — debe mostrar "¡Tu email quedó verificado!".
4. Ir a `/login`, ingresar con esas credenciales — debe redirigir a `/dashboard` y mostrar el email.
5. Click en "Cerrar sesión" — debe redirigir a `/login`.
6. Ir a `/dashboard` directamente sin sesión — debe redirigir a `/login` (confirma que la protección funciona).
7. Ir a `/forgot-password`, pedir recuperación con el mismo email — debe llegar un correo con link a `/reset-password?token=...`.
8. Abrir ese link, poner una contraseña nueva — debe redirigir a `/login`.
9. Loguearse con la contraseña nueva — debe funcionar. Loguearse con la vieja — debe fallar.

- [ ] **Step 5: Correr toda la suite de tests (backend + frontend) una vez más**

```bash
cd backend && deno task test && cd ..
cd frontend && npm test && cd ..
```

Expected: todo en verde.

- [ ] **Step 6: Bajar el stack**

```bash
docker compose down
```

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: wire JWT_SECRET, RESEND_API_KEY, and FRONTEND_URL into docker-compose"
```

- [ ] **Step 8: Push y confirmación del CI**

```bash
git push origin master:main
```

Ir a la pestaña "Actions" del repo en GitHub y confirmar que el workflow `CI` corre en verde para ambos jobs (`backend`, `frontend`). El job de backend no necesita `RESEND_API_KEY` real — los tests inyectan una implementación falsa del envío de email.
