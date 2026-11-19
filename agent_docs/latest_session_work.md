# Latest Session Work

## Completed deployment — model comparison visualization

- Route: Heavy; deployment `diff-model-comparison-view-20261030`.
- Goal: provide a simple local page/charts for existing Ollama versus Groq tests using JSON and CSV; include the recorded Gemini failure transparently.
- Status: complete. Public page `http://localhost:3000/comparacion-modelos` runs on frontend session 42167 and requires no login/backend/provider calls. New files are under `frontend/app/comparacion-modelos/`; the Node stdlib generator is `output/model-comparison/build-visualization.mjs`. It reproduces the exact runner payload and validates every saved input/data hash before generating the frontend-local snapshot, which also works within the frontend Docker build context.
- Delivered: responsive request-time/input-token charts, exact model and output-token records, an arithmetic check table, JSON/CSV input and original-response controls, source/hash/raw-metrics details and explicit methodology. Four completed API conditions compare `gemma4:e4b` on Ollama with `openai/gpt-oss-20b` on Groq. Gemini's HTTP 503 and later truncated JSON attempt are shown separately; there is no Gemini CSV run. Legacy local text captures are excluded because model/input provenance is missing.
- Verification: generator `--check`, frontend lint and TypeScript passed. Independent recalculation confirmed JSON/CSV equivalence and reference arithmetic; snapshot metrics/answers and exact payload hashes match the originals. Chromium checks passed at 1440, 390 and 320px: public HTTP 200, no document overflow, contained mobile table scrolling, keyboard JSON/CSV and details controls, matching values, no failed requests/console/page errors and localhost-only traffic. All 15 original source/API artifacts match the prep SHA-256 baseline. Evidence and screenshots are under `output/verification/model-comparison/`.
- Rebuild: run `node output/model-comparison/build-visualization.mjs`, then `node output/model-comparison/build-visualization.mjs --check`. The generator deliberately expects one complete saved run per primary provider/format; adding experiments requires explicit selection instead of silently pooling runs. No provider calls or original result changes occurred in this deployment.
- Interpretation limits: one request per model/format on synthetic TOP data; tokenizers and response lengths differ, and Ollama JSON includes 18.13 seconds of model load. Input-token reductions (Groq 49.4%, Ollama 52.8%) are observations within providers, not monetary savings. Arithmetic mismatches do not establish overall coaching quality; hardware/energy/cost were not measured. Browser verification covers Chromium, not other engines or screen readers. No commit or external publication was performed.
- Acceptance: numbers and answers trace to saved source files; units and missingness are explicit; useful responsive comparisons and source inspection work without new API calls; originals, credentials, unrelated work and local services are preserved. Do not invent quality scores, cost estimates or frontier-model claims.

## Completed deployment — application logo integration

- Route: Heavy; deployment `diff-logo-integration-20261030`.
- Goal: replace the old diamond/text brand treatment with the chosen option 04 logo across landing, authentication, navigation, dashboard shell, footer and 404. A compact D from the approved gallery may be used for small spaces. Browser title and accessible naming remain Diff.
- Scope: one small shared brand component, existing frontend brand call sites, scoped presentation styles and copied logo assets. Preserve the existing PNG artwork, unrelated source edits, benchmark results, documents and local services.
- Status: complete. Shared `frontend/app/components/BrandLogo.tsx` renders unchanged copies of gallery 04/06 under `frontend/public/branding/`. Landing, auth shell, generic Navbar, Sidebar, TopBar, footer and 404 use the component. Scoped CSS crops source padding and blends the opaque background. Metadata title remains Diff. At max-width 760px, the dashboard uses 36px compact symbols and hides duplicate TopBar links only while the Sidebar is open; closing it restores the links. The landing header switches to its compact symbol at 520px.
- Verification: frontend lint and `git diff --check` passed. Independent Chromium checks covered home/login/register/404/mocked dashboard at 1440, 390 and 320px: images decode, accessible naming is Diff, asset SHA-256 matches the originals, no horizontal overflow, uncaught page errors or local 5xx. The focused repair recheck confirmed all seven Sidebar product links plus profile/settings/logout pass hit tests without launcher overlap at 390/320px, menu close restores TopBar links, and desktop keeps its wordmark/navigation. Evidence: `output/verification/diff-logo/browser-results.json` and `repair-focused-results.json`, with screenshots in the same folder.
- Limits: dashboard checks use browser-only GET mocks, not a real authenticated journey; no account or external API calls were made. Generic Navbar has no live route consumer. An initial public-page pass recorded a repeatable Next.js development LCP warning and a non-reproducing input-style warning; focused repair checks had no console errors. The floating coach may still overlap main dashboard content on mobile and warrants separate UX work; Sidebar actions pass. No public-page matrix repeat was needed for the dashboard-scoped repair.
- Handoff: fresh HTTP requests returned 200 for `http://localhost:3000/` and `http://localhost:3001/`. Services remain running; the runtime uses a fresh disposable database, so earlier accounts are not present. No commit or external publication was performed. Unrelated source edits, benchmark results and public-kit artifacts were preserved.

## Current work — 2026-10-30

- Route: Heavy; deployment `diff-public-presentation-20261030`.
- Goal: create a Word report and PDF public presentation for Diff. The report requires two covers, headers/footers, three empty indexes, a novice glossary, a sourced historical introduction, and general/specific objectives. The presentation requires problem, current solutions, ecosystem, competitors, Diff's solution, objectives, and a comparison matrix.
- Status: complete. Editable report: [Diff_informe_academico.docx](../output/public-kit/document/Diff_informe_academico.docx). Independently laid-out 13-page preview: [Diff_informe_academico_preview.pdf](../output/public-kit/document/Diff_informe_academico_preview.pdf). Presentation: [diff-propuesta-academica.pdf](../output/public-kit/presentation/diff-propuesta-academica.pdf), 13 slides in 16:9 format.
- The report includes marketing/formal covers, body headers and page-number fields, three deliberately empty index pages, 113 alphabetized novice glossary terms, a sourced historical introduction, and the shared general/six specific objectives. Team, location and delivery-date lines remain blank. Branding and supplied formal metadata are recorded in [project_diary.md](project_diary.md).
- Independent verification passed: DOCX package/structure and unchanged embedded logo; report PDF content, 10.5 pt glossary text and page fit; presentation sections, exact objectives, comparison/status wording, source links and page bounds. Indexes are physical PDF pages 3–5, glossary 6–9, introduction 10–11, objectives 12 and references 13. Review artifacts are in `output/public-kit/verification/`.
- Limit: no Word/LibreOffice renderer was available. The editable DOCX was verified structurally; the independently generated PDF cannot certify its exact Word pagination. Open it in Word and review page breaks before printing. Regeneration instructions are in each deliverable folder.
- Historical and competitor evidence was checked on 2026-10-30 and is recorded in `output/public-kit/research/`. The comparison distinguishes documented features from unverified ones, limits Blitz claims to the available evidence, and marks Mobalytics Challenges availability as uncertain; no user-pilot or rank-improvement outcome is claimed.
- This work does not implement the discussed role-isolated evaluation or Bedrock changes. Existing source remains authoritative over aspirational claims in the older proposal.

## Analyzed snapshot

- Commit: `76adbe93d958244aa1f49a4c689d0a005fdedbf5`.
- Date: **2026-10-16**, America/Guatemala.
- Route: **Medium**; main owns synthesis, checks, and explicitly requested document edits. Two read-only Explorers covered backend/storage and frontend/tooling; their evidence was reconciled with direct feature/source inspection.
- Scope: onboarding, not a correctness/security/performance audit. Training is traced end to end; other features have a navigation/architecture map rather than equally deep traces.

## Saved findings and verification

[Overview](project_overview.md) owns purpose, architecture, training flow, inferences, and reading order. [Structure](project_structure.md) owns code/module navigation. [Core technologies](project_core_tech.md) owns storage, integrations, setup commands, and actual verification results. Progress and diary contain only status and lasting lessons.

Local lint/tests/build, PostgreSQL migrations, schema consistency, and API health were checked; exact counts and limitations are in [verification results](project_core_tech.md#verification-results). No new tests were written or assertions weakened. Verification created ignored frontend dependencies/build output and temporary tooling/database artifacts; no application source, tracked manifests, lockfiles, migrations, or configuration changed. The installation's pre-existing `.gitignore` change and untracked `agent_docs/` remain; no commit was created.

## Unanswered questions

- Do real Riot imports, configured LLM models, Resend delivery, and the optional League-client bridge work with the intended accounts/environment? These were not exercised.
- What deployment origin/HTTPS setup is intended? Source has a localhost default, fixed credentialed CORS origin, and SameSite=Lax cookie; cross-site deployment behavior needs explicit testing.
- Should routing expand beyond hardcoded `americas` / `la1`? No multi-region requirement was established.
- What concurrency guarantees are required for weekly generation/progress? Existing-plan checks and UI guards are implemented, but the inspected schema has no account/week unique constraint or unique progress-item constraint; parallel-request behavior was not tested.
- Which narrative docs should be reconciled next? `docs/arquitectura.md:47` implies all ten normalized participants, while ingestion normalizes the linked participant; its line 127 leaves SDK choice open although source uses fetch. `docs/modelo-entidad-relacion.md:120` calls weakness evidence metric IDs, while source and its later dictionary use participant IDs. Existing detailed docs were preserved.

## Continuation point

Begin at [the reading order](project_overview.md#reading-order). For the next verification task, configure a disposable local environment with a LAN Riot account, service keys, and the intended browser/API origins; exercise registration → email → login → Riot link/sync → ten metric-bearing matches → weekly plan → completion/reload. Compare responses and persisted rows with the saved training trace. Docker Desktop WSL integration must be enabled before using the documented Compose path. Investigate match-review batching/caching next if a second deep feature trace is wanted.
