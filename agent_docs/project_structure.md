# Project Structure

Source navigation verified for the [onboarding snapshot](latest_session_work.md#analyzed-snapshot). Architecture and the training trace live in [project_overview.md](project_overview.md); storage and commands live in [project_core_tech.md](project_core_tech.md).

## Backend

| Surface | Responsibility / important entry points |
| --- | --- |
| [src/main.ts](../backend/src/main.ts), [src/app.ts](../backend/src/app.ts) | Migration/startup entry and Hono composition, CORS, errors, `/health`. |
| [src/routes/auth.ts](../backend/src/routes/auth.ts), [src/auth/](../backend/src/auth) | `createAuthRoutes`; registration/login/logout/me, verification/reset; password hashes, JWTs, one-use tokens. |
| [src/routes/riot.ts](../backend/src/routes/riot.ts), [src/riot/](../backend/src/riot) | Link/sync/account endpoints; `linkRiotAccount`, `syncRiotAccount`, ingestion, Riot transport and stored stats. |
| [src/routes/training.ts](../backend/src/routes/training.ts), [src/analysis/](../backend/src/analysis) | Weakness/plan/progress endpoints; rules, plan assembly, provider routing, match-map analysis/context. |
| [src/routes/matches.ts](../backend/src/routes/matches.ts) | `/riot/matches`, `/:id`, `/:id/insights`; owned history/detail, legacy data enrichment and persisted map insights. |
| [src/routes/ai.ts](../backend/src/routes/ai.ts), [src/coaching/](../backend/src/coaching) | `/ai/chat`; server-derived player/match context via `playerCoachingContext`, `compactCoachContext`. |
| [src/routes/player.ts](../backend/src/routes/player.ts), [src/player/profile.ts](../backend/src/player/profile.ts) | Profile GET/PUT and opt-in ranking; preference validation and persistence. |
| [src/routes/settings.ts](../backend/src/routes/settings.ts), [src/email/resend.ts](../backend/src/email/resend.ts) | Account/password/unlink/delete operations; email delivery helpers. |
| [src/routes/preparation.ts](../backend/src/routes/preparation.ts), [src/preparation/](../backend/src/preparation) | Catalog and rule-based preparation guides; live-draft validation and optional local `companion.mjs`. |
| [src/routes/liveDraft.ts](../backend/src/routes/liveDraft.ts) | `/preparation/live`: download companion, pair/revoke device, accept bearer-authenticated snapshots, read session-authenticated status. |
| [src/db/](../backend/src/db), [scripts/](../backend/scripts) | Drizzle client/schema/committed SQL; migration CLI and disposable-container CI script. |

Route prefixes are authoritative in [app.ts:26](../backend/src/app.ts#L26). Route modules enforce authentication/ownership; the frontend shell is not the API's authorization boundary.

## Frontend

| Surface | Responsibility / important entry points |
| --- | --- |
| [app/layout.tsx](../frontend/app/layout.tsx), [app/page.tsx](../frontend/app/page.tsx) | Spanish root layout, fonts/global styling, public landing page. |
| [app/dashboard/layout.tsx](../frontend/app/dashboard/layout.tsx), [AppShell](../frontend/app/components/AppShell.tsx) | Shared authenticated shell, navigation, profile reminder, persistent chat context. |
| `app/login`, `register`, `verify-email`, `forgot-password`, `reset-password` | Public authentication pages; forms are in [app/components/](../frontend/app/components). |
| [app/dashboard/](../frontend/app/dashboard) | Thin pages for dashboard, history, match detail, weaknesses, training, profile/settings, Academy, ranking, preparation. `/plan` redirects to training. |
| [app/components/](../frontend/app/components) | Feature views such as `RiotAccountCard`, `TrainingHub`, `MatchDetailView`, `MatchEventMap`, `AiChatWidget`, `PreparationView`; [BrandLogo.tsx](../frontend/app/components/BrandLogo.tsx) renders the shared product mark. |
| [app/lib/](../frontend/app/lib) | `apiRequest`/`useResource`, feature hooks/types, Data Dragon caches, Academy editorial content, map projection. |
| [public/branding/](../frontend/public/branding), [app/globals.css](../frontend/app/globals.css) | Copies of logo options 04 and 06 used by `BrandLogo`; static assets and main styling. Tailwind setup is at the frontend root. |
| [app/comparacion-modelos/](../frontend/app/comparacion-modelos) | Public `/comparacion-modelos` results view; `snapshot.json` holds the local experiment data and `page.tsx` / `ComparisonDashboard.tsx` render it without provider requests. [`build-visualization.mjs`](../output/model-comparison/build-visualization.mjs) regenerates or checks that snapshot from saved experiment inputs and runs. |

## Public presentation kit

`[output/public-kit/](../output/public-kit/)` contains the report and presentation deliverables. `[document/](../output/public-kit/document/)` holds the editable `Diff_informe_academico.docx`, its independently laid-out PDF preview, and `generate_document.py` / `render_previews.py`; its [README](../output/public-kit/document/README.md) records the Word pagination limitation. `[presentation/](../output/public-kit/presentation/)` holds the 13-slide PDF and `build_presentation.py`. `[research/](../output/public-kit/research/)` contains the factpack and comparison data; `[verification/](../output/public-kit/verification/)` contains review renders. `[output/branding/diff/](../output/branding/diff/)` contains the selected logo option 04, [04-wordmark-dark-background.png](../output/branding/diff/v1/04-wordmark-dark-background.png).

## Tests and reference material

[backend/tests/](../backend/tests) mixes pure unit tests, mocked provider transports, and real PostgreSQL integration tests; `test_setup.ts` runs migrations. [frontend/tests/](../frontend/tests) uses Vitest/jsdom/Testing Library with mocked fetch. Neither suite establishes a live browser-to-provider journey.

[.github/workflows/ci.yml](../.github/workflows/ci.yml) defines CI. Root [docker-compose.yml](../docker-compose.yml) composes local services. [docs/](../docs) contains Spanish architecture, ERD, usage, feature notes, and historical `superpowers/` plans/specs; historical claims are not fresh verification. `agent_docs/` is the concise canonical onboarding/handoff framework. Code ownership by person/team is not declared by this analysis.
