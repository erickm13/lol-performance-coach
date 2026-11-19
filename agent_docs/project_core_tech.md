# Project Core Technologies

Evidence belongs to the [analyzed snapshot](latest_session_work.md#analyzed-snapshot). The architecture/feature trace is in [project_overview.md](project_overview.md).

## Runtime and session contract

Frontend: Next.js 14 / React 18 / TypeScript, Tailwind and global CSS; Vitest/jsdom/Testing Library. Backend: Deno/TypeScript, Hono, Drizzle ORM with `postgres`, bcryptjs, Resend SDK; other service calls use fetch. Versions are governed by [package-lock.json](../frontend/package-lock.json), [deno.lock](../backend/deno.lock), and manifests. [Backend Dockerfile](../backend/Dockerfile) pins Deno 2.9.6; [frontend Dockerfile](../frontend/Dockerfile) and CI use Node 20. README's minimum Deno version is less specific than that container pin.

`signSessionToken` creates a two-hour JWT. Login sets an HttpOnly, SameSite=Lax `session` cookie, with Secure enabled by `DENO_ENV=production`. Credentialed CORS accepts `FRONTEND_URL` (localhost:3000 by default). Browser API calls use `NEXT_PUBLIC_BACKEND_URL` (localhost:8000 default), compiled into the frontend bundle. Sources: [jwt.ts:13](../backend/src/auth/jwt.ts#L13), [createAuthRoutes](../backend/src/routes/auth.ts#L101), [CORS](../backend/src/app.ts#L18), [getBackendUrl](../frontend/app/lib/api.ts).

## Data storage

PostgreSQL 16 in Compose persists to `postgres_data`; host port 5433 maps to container 5432. `DATABASE_URL` is required at backend import time. Drizzle defines 14 public tables in [schema.ts](../backend/src/db/schema.ts):

| Domain | Tables and relationships |
| --- | --- |
| Identity | `users`; one-to-one `player_profiles`; `auth_tokens` for verification/reset. |
| Riot ingestion | `riot_accounts` references users and uniquely identifies a PUUID; `ingestion_jobs` tracks attempts, counts, partial/error status. |
| Match data | `matches` uniquely identifies Riot matches and caches raw detail/timeline JSONB; `match_participants` connects account to match; `match_teammates` references participant; `match_metrics` is one-to-one with participant. |
| Training | Account → `weaknesses`, `training_plans` → ordered `training_plan_items` → `plan_progress`. Weakness evidence and item evidence references contain participant UUIDs. |
| Device bridge | `live_draft_connections` stores one expiring/revocable token hash and latest snapshot per user. |

API match IDs are internal UUIDs, distinct from Riot match IDs. Map coaching persists in `match_metrics.extra.mapInsights`; raw Riot payloads remain server-side. See [matches route:268](../backend/src/routes/matches.ts#L268), [insight write:431](../backend/src/routes/matches.ts#L431). The ingestion implementation stores the linked player's participant/metrics and teammate records, rather than normalizing all ten players into participant rows ([ingestMatches:105](../backend/src/riot/ingest.ts#L105)).

Committed migrations `0000`–`0010` are applied by `runMigrations`, relative to the backend working directory. `db:generate` authors migrations from the schema; applying existing migrations is sufficient for normal setup. Sources: [db/migrate.ts](../backend/src/db/migrate.ts), [deno tasks](../backend/deno.json), [drizzle.config.ts](../backend/drizzle.config.ts). No Redis client/queue was found in backend source; `REDIS_URL` is reserved in [.env.example](../.env.example).

## External dependencies

| Service | Source-verified use / configuration |
| --- | --- |
| Riot REST | [riot/client.ts:1](../backend/src/riot/client.ts#L1): `RIOT_API_KEY`, Account/Match routing `americas`, platform `la1` hardcoded. No runtime fake-data fallback. |
| Groq / Gemini | [llm.ts:13](../backend/src/analysis/llm.ts#L13): either key can serve coaching; Groq preferred for chat/plan, Gemini for map. Eligible transient/quota failures can use the other configured provider; cooldowns are process-local. Source defaults: `openai/gpt-oss-20b` and `GEMINI_MODEL` or `gemini-3.8-flash` ([groq.ts](../backend/src/analysis/groq.ts), [gemini.ts](../backend/src/analysis/gemini.ts)). These are configured strings, not verified model availability. Missing keys permit rules-only plans; chat/map errors remain visible. |
| Resend | [email/resend.ts](../backend/src/email/resend.ts): `RESEND_API_KEY`; verification/reset links use `FRONTEND_URL`; sender is `onboarding@resend.dev`. Delivery failures are logged; registration success does not prove delivery. |
| Data Dragon | [frontend catalogs](../frontend/app/lib/dataDragon.ts), [useDataDragon](../frontend/app/lib/useDataDragon.ts), [preparation catalog](../backend/src/preparation/catalog.ts): browser assets/catalog requests and backend cached catalogs. |
| Google Fonts / YouTube | [root layout](../frontend/app/layout.tsx) downloads fonts during build; [academyVideo](../frontend/app/lib/academyVideo.ts) supplies external learning video links/embeds. |
| Optional League client | Local Node [companion.mjs](../backend/src/preparation/companion.mjs) reads client state and sends sanitized snapshots to the paired backend; see [live-client guide](../docs/cliente-en-vivo.md). Static mapping only, no client validation. |

## Development workflow

From the root, the documented container path is `cp .env.example .env`, configure keys, then `docker compose up -d --build`; frontend is :3000 and backend health is :8000/health. `docker compose down` stops services. Compose starts Redis as well as PostgreSQL/API/UI. [README](../README.md), [Compose](../docker-compose.yml).

For local processes, provision PostgreSQL first. In a shell with variables explicitly exported from your local configuration:

```bash
# backend working directory
export DATABASE_URL=postgres://lol_analytics:lol_analytics@localhost:5433/lol_analytics
export JWT_SECRET=replace-with-a-local-secret
export FRONTEND_URL=http://localhost:3000
deno task db:migrate
deno task dev

# frontend working directory, separate terminal
npm ci
npm run dev
```

Configure `RIOT_API_KEY` for imports, `RESEND_API_KEY` for email, and either coach key for LLM explanations. Startup itself requires the database; signing sessions requires `JWT_SECRET`. Native `deno task dev` does not include `--env-file`, so merely copying root `.env` does not load it. Compose reads/passes its configured environment. The public backend URL must be browser-reachable and set before a production frontend build.

CI commands: backend `deno task lint`, `db:generate`, `db:migrate`, `test`; frontend `npm run lint`, `npm test`, `npm run build`. [CI](../.github/workflows/ci.yml). Backend tests run migrations and write fixtures: use a disposable database. [check-ci.sh](../backend/scripts/check-ci.sh) creates one in Docker and cleans it up; do not aim tests at a valued match database.

## Verification results

Run on the recorded onboarding date using Node 24.3.0, npm 11.11.1, temporary Deno 2.9.6, and disposable PostgreSQL 16.15. Node 20 CI/container parity was not exercised. Deno/npm caches and PostgreSQL data were placed in `/tmp`; the database was stopped after checks. External-service credentials were unset for backend checks; transports are mocked in provider tests.

| Command / check | Observed result |
| --- | --- |
| Frontend `npm ci` | Passed using committed lockfile; dependency deprecation warnings. |
| Frontend `npm run lint` | Passed without lint warnings/errors. |
| Frontend `npm test` | 17 files, 46 tests passed. |
| Frontend `npm run build` | Passed: compilation, type checks, prerendering, build traces. Font fetch retries occurred and recovered. |
| Backend `deno task lint` | Passed, 54 files checked. |
| Backend `deno task db:migrate` | Passed on empty disposable PostgreSQL. |
| Backend `deno task test` | 113 passed, 0 failed, including plan/route/ownership/provider-fallback checks. |
| Backend `deno task start`, GET `/health` | Started after migrations; HTTP 200 with `status=ok`, `db=connected` on temporary port 58039. |
| Backend `deno task db:generate` | Passed in a temporary backend copy; 14 tables, no schema changes; migration files byte-identical. Initial sandbox denial creating Drizzle user data was resolved by an approved rerun. |
| Docker / full live journey | Docker unavailable through current WSL integration; Compose and its CI helper were not run. Live Riot/email/LLM/League-client behavior was not checked. |
