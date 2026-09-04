# Scaffolding Inicial del Repositorio — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el esqueleto funcional (walking skeleton) del monorepo: frontend Next.js, backend Deno + Hono + Drizzle, PostgreSQL, Redis, Docker Compose y CI, con un circuito de salud verificable de punta a punta (frontend → backend → base de datos).

**Architecture:** Monorepo con `/frontend` (Next.js App Router) y `/backend` (Deno + Hono + Drizzle ORM sobre PostgreSQL). El backend expone `GET /health`, que confirma la conexión a la base de datos; el frontend lo consume desde un componente cliente. PostgreSQL y Redis corren como contenedores; Redis queda reservado para trabajos futuros (ingesta/colas), fuera de este alcance.

**Tech Stack:** Deno 2.x, Hono ^4.6.0 (`jsr:@hono/hono`), Drizzle ORM ^0.36.0 + drizzle-kit ^0.28.0 + postgres.js (`npm:postgres`) ^3.4.4, PostgreSQL 16, Redis 7, Next.js ^14.2.0, React ^18.3.0, Tailwind ^3.4.0, Vitest ^2.1.0 + Testing Library ^16, Docker / Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-04-repo-scaffolding-design.md`

## Global Constraints

- Deno >= 2.0
- Node.js >= 20 para el tooling del frontend
- PostgreSQL 16 (imagen `postgres:16-alpine`)
- Redis 7 (imagen `redis:7-alpine`) — solo el contenedor; ningún código lo usa todavía
- Hono ^4.6.0, Drizzle ORM ^0.36.0, drizzle-kit ^0.28.0, postgres.js (`npm:postgres`) ^3.4.4
- Next.js ^14.2.0, React ^18.3.0, Tailwind ^3.4.0
- Vitest ^2.1.0, @testing-library/react ^16.0.0
- Ninguna pantalla o endpoint de negocio real (auth, ingesta, métricas, planes) — fuera de alcance de este plan

---

### Task 1: Esquema de base de datos (Drizzle)

**Files:**
- Create: `backend/deno.json`
- Create: `backend/src/db/schema.ts`
- Test: `backend/tests/schema.test.ts`
- Create: `.gitignore` (raíz del repo)

**Interfaces:**
- Produces: `backend/src/db/schema.ts` exporta las constantes `users`, `riotAccounts`, `ingestionJobs`, `matches`, `matchParticipants`, `matchMetrics`, `weaknesses`, `trainingPlans`, `trainingPlanItems`, `planProgress` (cada una una `pgTable` de Drizzle). Tareas posteriores importan este módulo completo (`import * as schema from "./schema.ts"`).

- [ ] **Step 1: Crear `backend/deno.json`**

```json
{
  "tasks": {
    "dev": "deno run -A --watch src/main.ts",
    "start": "deno run -A src/main.ts",
    "test": "deno test -A",
    "lint": "deno lint",
    "db:generate": "deno run -A npm:drizzle-kit@^0.28.0 generate",
    "db:migrate": "deno run -A scripts/migrate.ts"
  },
  "lock": true
}
```

- [ ] **Step 2: Crear `.gitignore` en la raíz del repo**

```
node_modules/
.next/
dist/
*.log
.env
.DS_Store
```

- [ ] **Step 3: Escribir el test que falla — `backend/tests/schema.test.ts`**

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
```

- [ ] **Step 4: Correr el test y confirmar que falla**

Run: `cd backend && deno test -A tests/schema.test.ts`
Expected: FAIL — no se puede resolver el módulo `../src/db/schema.ts` (todavía no existe).

- [ ] **Step 5: Implementar `backend/src/db/schema.ts`**

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  boolean,
  real,
  jsonb,
} from "npm:drizzle-orm@^0.36.0/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const riotAccounts = pgTable("riot_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  puuid: text("puuid").notNull().unique(),
  summonerName: text("summoner_name").notNull(),
  tagLine: text("tag_line").notNull(),
  region: text("region").notNull(),
  primaryRole: text("primary_role"),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  riotAccountId: uuid("riot_account_id").notNull().references(() => riotAccounts.id),
  status: text("status").notNull().default("pending"),
  matchesRequested: integer("matches_requested").notNull(),
  matchesIngested: integer("matches_ingested").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
});

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  riotMatchId: text("riot_match_id").notNull().unique(),
  patchVersion: text("patch_version"),
  queueId: integer("queue_id"),
  gameCreation: timestamp("game_creation", { withTimezone: true }).notNull(),
  gameDurationSeconds: integer("game_duration_seconds").notNull(),
});

export const matchParticipants = pgTable("match_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matches.id),
  riotAccountId: uuid("riot_account_id").references(() => riotAccounts.id),
  puuid: text("puuid").notNull(),
  champion: text("champion").notNull(),
  role: text("role"),
  teamId: integer("team_id").notNull(),
  win: boolean("win").notNull(),
  kills: integer("kills").notNull(),
  deaths: integer("deaths").notNull(),
  assists: integer("assists").notNull(),
  csTotal: integer("cs_total").notNull(),
  visionScore: integer("vision_score").notNull(),
  goldTotal: integer("gold_total").notNull(),
  damageTotal: integer("damage_total").notNull(),
  rawStats: jsonb("raw_stats"),
});

export const matchMetrics = pgTable("match_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchParticipantId: uuid("match_participant_id")
    .notNull()
    .unique()
    .references(() => matchParticipants.id),
  csPerMin: real("cs_per_min").notNull(),
  kda: real("kda").notNull(),
  visionScorePerMin: real("vision_score_per_min").notNull(),
  deathsBefore10: integer("deaths_before_10").notNull(),
  goldPerMin: real("gold_per_min").notNull(),
  damagePerMin: real("damage_per_min").notNull(),
  killParticipation: real("kill_participation").notNull(),
  extra: jsonb("extra"),
});

export const weaknesses = pgTable("weaknesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  riotAccountId: uuid("riot_account_id").notNull().references(() => riotAccounts.id),
  category: text("category").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  evidence: jsonb("evidence").notNull(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trainingPlans = pgTable("training_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  riotAccountId: uuid("riot_account_id").notNull().references(() => riotAccounts.id),
  weekStart: date("week_start").notNull(),
  weekEnd: date("week_end").notNull(),
  status: text("status").notNull().default("active"),
  generatedBy: text("generated_by").notNull(),
});

export const trainingPlanItems = pgTable("training_plan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  trainingPlanId: uuid("training_plan_id").notNull().references(() => trainingPlans.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  llmExplanation: text("llm_explanation"),
  evidenceMetricRefs: jsonb("evidence_metric_refs"),
});

export const planProgress = pgTable("plan_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  trainingPlanItemId: uuid("training_plan_item_id")
    .notNull()
    .references(() => trainingPlanItems.id),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  selfRating: integer("self_rating"),
  note: text("note"),
});
```

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `deno test -A tests/schema.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add .gitignore backend/deno.json backend/src/db/schema.ts backend/tests/schema.test.ts backend/deno.lock
git commit -m "feat(backend): define Drizzle schema for the 10 ER model tables"
```

---

### Task 2: Cliente de base de datos y migraciones

**Files:**
- Create: `backend/drizzle.config.ts`
- Create: `backend/src/db/client.ts`
- Create: `backend/src/db/migrate.ts`
- Create: `backend/scripts/migrate.ts`
- Test: `backend/tests/db.test.ts`

**Interfaces:**
- Consumes: `schema.ts` (Task 1) — todas las tablas exportadas, importadas como `import * as schema from "./schema.ts"`.
- Produces: `db` (instancia de Drizzle) desde `backend/src/db/client.ts`. `runMigrations(): Promise<void>` desde `backend/src/db/migrate.ts` — usada por `scripts/migrate.ts` y por `main.ts` en la Task 3.

- [ ] **Step 1: Levantar Postgres localmente para desarrollo/pruebas**

```bash
docker network create lol-net 2>/dev/null || true
docker run --rm -d --name lol-postgres --network lol-net \
  -e POSTGRES_USER=lol_analytics -e POSTGRES_PASSWORD=lol_analytics -e POSTGRES_DB=lol_analytics \
  -p 5432:5432 postgres:16-alpine
```

Exportar la variable de entorno que usarán los siguientes comandos:

```bash
export DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5432/lol_analytics
```

- [ ] **Step 2: Crear `backend/drizzle.config.ts`**

```typescript
import { defineConfig } from "npm:drizzle-kit@^0.28.0";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: Deno.env.get("DATABASE_URL") ?? "",
  },
});
```

- [ ] **Step 3: Escribir el test que falla — `backend/tests/db.test.ts`**

```typescript
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import postgres from "npm:postgres@^3.4.4";
import { runMigrations } from "../src/db/migrate.ts";

Deno.test("runMigrations crea las 10 tablas del modelo entidad-relación", async () => {
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

- [ ] **Step 4: Correr el test y confirmar que falla**

Run: `deno test -A tests/db.test.ts`
Expected: FAIL — no se puede resolver `../src/db/migrate.ts` (todavía no existe).

- [ ] **Step 5: Implementar `backend/src/db/client.ts`**

```typescript
import { drizzle } from "npm:drizzle-orm@^0.36.0/postgres-js";
import postgres from "npm:postgres@^3.4.4";
import * as schema from "./schema.ts";

const connectionString = Deno.env.get("DATABASE_URL");
if (!connectionString) {
  throw new Error("La variable de entorno DATABASE_URL es requerida");
}

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
```

- [ ] **Step 6: Implementar `backend/src/db/migrate.ts`**

```typescript
import { migrate } from "npm:drizzle-orm@^0.36.0/postgres-js/migrator";
import { db } from "./client.ts";

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
}
```

- [ ] **Step 7: Implementar `backend/scripts/migrate.ts`**

```typescript
import { runMigrations } from "../src/db/migrate.ts";

await runMigrations();
console.log("Migraciones aplicadas correctamente");
```

- [ ] **Step 8: Generar el archivo de migración SQL a partir del esquema**

Run: `deno task db:generate`
Expected: crea uno o más archivos `.sql` dentro de `backend/src/db/migrations/`.

- [ ] **Step 9: Correr el test y confirmar que pasa**

Run: `deno test -A tests/db.test.ts`
Expected: PASS (1 test).

- [ ] **Step 10: Commit**

```bash
git add backend/drizzle.config.ts backend/src/db/client.ts backend/src/db/migrate.ts backend/scripts/migrate.ts backend/tests/db.test.ts backend/src/db/migrations
git commit -m "feat(backend): add Drizzle client, migrator, and initial migration"
```

---

### Task 3: Endpoint `GET /health` (Hono)

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/src/main.ts`
- Test: `backend/tests/health.test.ts`

**Interfaces:**
- Consumes: `db` desde `backend/src/db/client.ts` (Task 2); `runMigrations` desde `backend/src/db/migrate.ts` (Task 2).
- Produces: `app` (instancia de `Hono`) exportada desde `backend/src/app.ts`, usada por `main.ts` y por los tests.

- [ ] **Step 1: Confirmar que Postgres sigue corriendo y exportar `DATABASE_URL` en esta shell**

Esta tarea corre en una sesión nueva: la variable `DATABASE_URL` exportada durante la Task 2 no persiste aquí. Hay que volver a exportarla.

**Nota:** en esta máquina el puerto host 5432 ya estaba ocupado por un contenedor de otro proyecto, así que la Task 2 publicó `lol-postgres` en el puerto host **5433** (`-p 5433:5432`) en vez de 5432. El puerto interno del contenedor sigue siendo 5432 — esto solo afecta las URLs que usan `localhost` (acceso desde fuera de Docker), no las que usan `lol-postgres` como host (contenedor a contenedor).

```bash
docker ps --filter name=lol-postgres --format '{{.Names}}'
export DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5433/lol_analytics
```

Expected: el primer comando imprime `lol-postgres`. Si no aparece, repetir el `docker run` de la Task 2 antes de continuar.

- [ ] **Step 2: Escribir el test que falla — `backend/tests/health.test.ts`**

```typescript
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { app } from "../src/app.ts";

Deno.test("GET /health responde 200 y confirma la conexión a la base de datos", async () => {
  const res = await app.request("/health");
  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(body.status, "ok");
  assertEquals(body.db, "connected");
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `deno test -A tests/health.test.ts`
Expected: FAIL — no se puede resolver `../src/app.ts` (todavía no existe).

- [ ] **Step 4: Implementar `backend/src/app.ts`**

```typescript
import { Hono } from "jsr:@hono/hono@^4.6.0";
import { db } from "./db/client.ts";
import { sql } from "npm:drizzle-orm@^0.36.0";

export const app = new Hono();

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

- [ ] **Step 5: Implementar `backend/src/main.ts`**

```typescript
import { app } from "./app.ts";
import { runMigrations } from "./db/migrate.ts";

await runMigrations();

const port = Number(Deno.env.get("PORT") ?? "8000");
console.log(`Backend escuchando en http://localhost:${port}`);
Deno.serve({ port }, app.fetch);
```

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `deno test -A tests/health.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Verificación manual del servidor completo**

```bash
deno task dev
```

En otra terminal:

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok","db":"connected"}`. Detener el servidor con Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add backend/src/app.ts backend/src/main.ts backend/tests/health.test.ts
git commit -m "feat(backend): add Hono app with GET /health endpoint"
```

---

### Task 4: Contenerizar el backend

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

**Interfaces:**
- Consumes: `backend/src/main.ts` (Task 3) como punto de entrada del contenedor.
- Produces: imagen Docker `lol-backend`, usada por `docker-compose.yml` en la Task 7.

- [ ] **Step 1: Crear `backend/.dockerignore`**

```
tests/
*.test.ts
```

- [ ] **Step 2: Crear `backend/Dockerfile`**

```dockerfile
FROM denoland/deno:2.9.6

WORKDIR /app

COPY deno.json deno.lock* ./
COPY src ./src
COPY scripts ./scripts
COPY drizzle.config.ts ./

RUN deno cache src/main.ts

EXPOSE 8000

CMD ["deno", "run", "-A", "src/main.ts"]
```

**Nota:** la imagen base se fija en `2.9.6` (la misma versión de Deno usada en todas las tareas anteriores) en vez de `2.0.0` — `backend/deno.lock` usa el formato de lockfile versión 5, que `denoland/deno:2.0.0` no soporta (`Unsupported lockfile version '5'`), y esto rompía un build limpio (`--no-cache`) desde un checkout nuevo. `2.9.6` sigue cumpliendo la restricción global "Deno >= 2.0" y mantiene el lockfile como fuente de verdad para las versiones ya fijadas.

- [ ] **Step 3: Construir la imagen**

Run: `docker build -t lol-backend ./backend`
Expected: build termina sin errores.

- [ ] **Step 4: Correr el contenedor conectado a Postgres y verificar el health check**

```bash
docker run --rm -d --name lol-backend --network lol-net -p 8000:8000 \
  -e DATABASE_URL=postgres://lol_analytics:lol_analytics@lol-postgres:5432/lol_analytics \
  -e PORT=8000 \
  lol-backend
sleep 2
curl http://localhost:8000/health
```

Expected: `{"status":"ok","db":"connected"}`.

- [ ] **Step 5: Limpiar el contenedor de prueba**

```bash
docker stop lol-backend
```

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat(backend): containerize backend with Docker"
```

---

### Task 5: Scaffold del frontend + componente de estado de salud

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.js`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/tests/setup.ts`
- Create: `frontend/app/globals.css`
- Create: `frontend/app/layout.tsx`
- Create: `frontend/app/page.tsx`
- Create: `frontend/app/components/HealthStatus.tsx`
- Test: `frontend/tests/HealthStatus.test.tsx`

**Interfaces:**
- Produces: componente `HealthStatus` (export nombrado) desde `frontend/app/components/HealthStatus.tsx`, usado por `frontend/app/page.tsx`. Lee `process.env.NEXT_PUBLIC_BACKEND_URL` (con fallback a `http://localhost:8000`) y hace `fetch` a `${backendUrl}/health`.

- [ ] **Step 1: Crear `frontend/package.json`**

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^2.1.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0"
  }
}
```

- [ ] **Step 2: Crear `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Crear `frontend/next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
```

- [ ] **Step 4: Crear `frontend/tailwind.config.ts` y `frontend/postcss.config.js`**

`frontend/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

`frontend/postcss.config.js`:

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Crear `frontend/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Crear `frontend/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoL Performance Coach",
  description:
    "Plataforma de análisis y entrenamiento personalizado para League of Legends",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Instalar dependencias**

Run: `cd frontend && npm install`
Expected: termina sin errores, crea `node_modules/` y `package-lock.json`.

- [ ] **Step 8: Configurar Vitest — `frontend/vitest.config.ts` y `frontend/tests/setup.ts`**

`frontend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
```

`frontend/tests/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 9: Escribir el test que falla — `frontend/tests/HealthStatus.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthStatus } from "../app/components/HealthStatus";

describe("HealthStatus", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ status: "ok", db: "connected" }),
        }),
      ) as unknown as typeof fetch,
    );
  });

  it("muestra el estado del backend una vez que el fetch resuelve", async () => {
    render(<HealthStatus />);

    expect(
      screen.getByText(/cargando estado del sistema/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/estado del backend/i)).toBeInTheDocument();
    });
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(screen.getByText("connected")).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Correr el test y confirmar que falla**

Run: `npm test`
Expected: FAIL — no se puede resolver `../app/components/HealthStatus` (todavía no existe).

- [ ] **Step 11: Implementar `frontend/app/components/HealthStatus.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  db: string;
};

export function HealthStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    fetch(`${backendUrl}/health`)
      .then((res) => res.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <p role="alert">Error al conectar con el backend: {error}</p>;
  }

  if (!health) {
    return <p>Cargando estado del sistema...</p>;
  }

  return (
    <p>
      Estado del backend: <strong>{health.status}</strong> — Base de datos:{" "}
      <strong>{health.db}</strong>
    </p>
  );
}
```

- [ ] **Step 12: Implementar `frontend/app/page.tsx`**

```tsx
import { HealthStatus } from "./components/HealthStatus";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h1 className="text-2xl font-bold">
        Plataforma de análisis para League of Legends
      </h1>
      <HealthStatus />
    </main>
  );
}
```

- [ ] **Step 13: Correr el test y confirmar que pasa**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 14: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold Next.js app with health status component"
```

---

### Task 6: Contenerizar el frontend

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`

**Interfaces:**
- Consumes: build de producción de `frontend/` (Task 5).
- Produces: imagen Docker `lol-frontend`, usada por `docker-compose.yml` en la Task 7.

- [ ] **Step 1: Crear `frontend/.dockerignore`**

```
node_modules/
.next/
tests/
```

- [ ] **Step 2: Crear `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

**Nota:** se agrega `RUN apk add --no-cache libc6-compat` — sin esto, un build limpio (`--no-cache`) de Next.js 14 sobre Alpine falla con SIGSEGV durante "Collecting build traces" (Alpine usa musl libc; algunos binarios nativos que usa Next.js/SWC para el trace collection esperan shims de glibc). Es el fix estándar documentado en el ejemplo oficial de Docker de Next.js — mantiene la imagen Alpine (liviana) en vez de cambiar a `node:20` (Debian, mucho más pesada).

- [ ] **Step 3: Construir la imagen**

Run: `docker build -t lol-frontend ./frontend`
Expected: build termina sin errores (incluye `npm run build` de Next.js).

- [ ] **Step 4: Correr el contenedor y verificar que sirve HTML**

```bash
docker run --rm -d --name lol-frontend -p 3000:3000 lol-frontend
sleep 2
curl -s http://localhost:3000 | grep -i "cargando estado"
```

Expected: la búsqueda encuentra el texto (la página renderiza el estado inicial "Cargando..." en el HTML del servidor antes de hidratar).

- [ ] **Step 5: Limpiar el contenedor de prueba**

```bash
docker stop lol-frontend
```

- [ ] **Step 6: Commit**

```bash
git add frontend/Dockerfile frontend/.dockerignore
git commit -m "feat(frontend): containerize frontend with Docker"
```

---

### Task 7: Docker Compose — orquestar los 4 servicios

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

**Interfaces:**
- Consumes: `backend/Dockerfile` (Task 4), `frontend/Dockerfile` (Task 6).
- Produces: entorno local completo levantable con `docker compose up`.

- [ ] **Step 1: Detener los contenedores/red manuales de tareas anteriores (si siguen corriendo)**

```bash
docker stop lol-postgres 2>/dev/null || true
docker network rm lol-net 2>/dev/null || true
```

- [ ] **Step 2: Crear `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: lol_analytics
      POSTGRES_PASSWORD: lol_analytics
      POSTGRES_DB: lol_analytics
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lol_analytics"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://lol_analytics:lol_analytics@postgres:5432/lol_analytics
      PORT: "8000"
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      args:
        NEXT_PUBLIC_BACKEND_URL: http://localhost:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

**Nota:** se agrega un `healthcheck` a `postgres` y se cambia `depends_on` de `backend` a `condition: service_healthy` — sin esto, `postgres:16-alpine` reinicia internamente durante su primera inicialización (init db → shutdown → arranque real), y `depends_on` sin condición solo espera a que el contenedor *arranque*, no a que Postgres acepte conexiones. El backend no tiene reintento de conexión al iniciar, así que se caía en el primer `docker compose up` de un volumen limpio. Con el healthcheck, Compose espera a que Postgres esté realmente listo antes de arrancar el backend.

- [ ] **Step 3: Crear `.env.example` en la raíz**

```
DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5432/lol_analytics
REDIS_URL=redis://localhost:6379
PORT=8000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ANTHROPIC_API_KEY=
RIOT_API_KEY=
```

- [ ] **Step 4: Levantar todo el stack y verificar**

```bash
docker compose up -d --build
docker compose ps
```

Expected: los 4 servicios (`postgres`, `redis`, `backend`, `frontend`) en estado `Up`/`running`.

```bash
curl http://localhost:8000/health
curl -s http://localhost:3000 | grep -i "cargando estado"
```

Expected: el primero devuelve `{"status":"ok","db":"connected"}`; el segundo encuentra el texto.

- [ ] **Step 5: Bajar el stack**

```bash
docker compose down
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: wire postgres, redis, backend, and frontend with Docker Compose"
```

---

### Task 8: CI con GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `backend/deno.json`

**Interfaces:**
- Consumes: `deno task lint`, `deno task db:generate`, `deno task db:migrate`, `deno task test` (backend, Tasks 1-3); `npm run lint`, `npm test`, `npm run build` (frontend, Task 5).

**Nota — bloqueante para esta tarea:** `deno lint` falla actualmente con 10 errores `no-import-prefix` (uno por cada import inline `npm:`/`jsr:` en `client.ts`, `migrate.ts`, `app.ts`, y los 4 archivos de test — exactamente los especificadores que las Tasks 1, 2 y 3 usaron verbatim, tal como pedían sus briefs). Como el workflow de CI corre `deno task lint` como primer paso del job de backend, esto haría fallar el CI de entrada. Los specificadores inline `npm:`/`jsr:` son sintaxis de Deno completamente válida y de primera clase — la regla `no-import-prefix` es una preferencia de estilo opcional, no un requisito de corrección, y reescribir los 6 archivos ya aprobados a especificadores planos (como se hizo puntualmente para `drizzle-kit`/`schema.ts` por una razón técnica distinta) sería un cambio mucho más invasivo de lo necesario. En vez de eso, esta tarea debe desactivar esa regla específica en `backend/deno.json` antes de escribir el workflow.

- [ ] **Step 1 (previo): Actualizar `backend/deno.json`**

Agregar la clave `"lint"` (puede ir en cualquier posición del objeto raíz, por ejemplo después de `"imports"`):

```json
"lint": {
  "rules": {
    "exclude": ["no-import-prefix"]
  }
}
```

Verificar: `cd backend && deno lint` — debe imprimir `Checked 10 files` sin errores y salir con código 0.

- [ ] **Step 2: Crear `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: lol_analytics
          POSTGRES_PASSWORD: lol_analytics
          POSTGRES_DB: lol_analytics
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgres://lol_analytics:lol_analytics@localhost:5432/lol_analytics
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - run: deno task lint
      - run: deno task db:generate
      - run: deno task db:migrate
      - run: deno task test

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 3: Verificar que el YAML es válido**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` (o cualquier validador de YAML disponible)
Expected: no lanza error de parseo. (La verificación real del workflow ocurre al hacer push — no hay forma de correr GitHub Actions localmente sin herramientas adicionales.)

- [ ] **Step 4: Correr localmente los mismos comandos que el job de backend, en orden, para confirmar que el workflow pasaría**

```bash
cd backend
deno task lint
deno task db:generate
deno task db:migrate
deno task test
```

Expected: los 4 comandos terminan con código 0 (el primero ya no falla gracias al Step 1).

- [ ] **Step 5: Commit**

```bash
git add backend/deno.json .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for backend and frontend"
```

---

### Task 9: README y verificación final de punta a punta

**Files:**
- Create: `README.md`

**Interfaces:**
- Ninguna — tarea de documentación y verificación final, no agrega código.

- [x] **Step 1: Crear `README.md` en la raíz**

```markdown
# Plataforma de análisis y entrenamiento personalizado — League of Legends

Proyecto de Seminario Profesional 2. Ver el contexto completo en:

- [docs/propuesta.md](docs/propuesta.md) — objetivos, alcance y justificación
- [docs/arquitectura.md](docs/arquitectura.md) — arquitectura lógica y flujo end-to-end
- [docs/modelo-entidad-relacion.md](docs/modelo-entidad-relacion.md) — modelo de datos completo

## Requisitos

- Docker y Docker Compose
- Deno >= 2.0 (solo para correr el backend fuera de Docker)
- Node.js >= 20 (solo para correr el frontend fuera de Docker)

## Levantar el proyecto localmente

\`\`\`bash
cp .env.example .env
docker compose up -d --build
\`\`\`

- Frontend: http://localhost:3000
- Backend: http://localhost:8000/health

Para bajar todo: \`docker compose down\`

## Desarrollo sin Docker

### Backend

\`\`\`bash
cd backend
export DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5432/lol_analytics
deno task db:generate
deno task db:migrate
deno task dev
\`\`\`

### Frontend

\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

## Tests

\`\`\`bash
cd backend && deno task test
cd frontend && npm test
\`\`\`
```

- [x] **Step 2: Verificación final contra la "Definición de hecho" del spec**

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health
curl -s http://localhost:3000 | grep -i "cargando estado"
export DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5432/lol_analytics
cd backend && deno task test && cd ..
cd frontend && npm test && cd ..
docker compose down
```

Expected: los 4 servicios arriba, ambos `curl` devuelven lo esperado, ambas suites de test pasan. Esto cubre todos los puntos de la sección "Definición de hecho" de `docs/superpowers/specs/2026-09-04-repo-scaffolding-design.md`, salvo el estado del workflow de CI (que solo se confirma en GitHub tras el push).

- [x] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with local setup instructions"
```

- [ ] **Step 4: Push y confirmación del CI**

```bash
git push -u origin master
```

Ir a la pestaña "Actions" del repositorio en GitHub y confirmar que el workflow `CI` corre en verde para ambos jobs (`backend`, `frontend`).
