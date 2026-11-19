# Project Diary

## 2026-10-30 — model comparison visualization

- Compare saved experiment outputs without calling providers again or overwriting user results. Separate runtime location/provider from model identity; do not label a cloud-hosted model as a frontier model solely because it runs in the cloud.
- Preserve missing measurements as unavailable, and distinguish a failed Gemini request from a successful evaluation. Small observational samples do not establish universal model quality or cost rankings.
- Ollama JSON's request time includes about 18.13 seconds of model loading, unlike its CSV run; do not attribute their latency difference to format. Compare input-token reductions within each tokenizer and keep numerical correctness separate from coaching quality.
- Validate the exact runner prompt-plus-data hash before rebuilding a visual snapshot. Pairwise matching run hashes alone cannot establish that an edited prompt still describes old results.

## 2026-10-30 — public presentation decisions

- The official product name is Diff. The user selected logo option 04 for the presentation materials; the logo concepts are under `output/branding/diff/v1/`.
- Formal presentation metadata supplied by the user: Universidad Galileo, Ingeniería en Sistemas, Seminario Profesional 2, docente Axel Benavides. Leave team members and submission date blank for editing.
- Public claims must distinguish the implemented prototype from proposed role-isolated ten-match evaluations and Bedrock migration. Rules select weekly plan items; LLMs explain them, while map review uses LLM event assessments.
- Historical framing must use sourced examples rather than an invented ancient coaching chronology. Competitor comparisons must distinguish documented features from features not verified in the consulted sources.
- Preserve readable type rather than compressing a comprehensive glossary to an arbitrary page count. The public kit uses 10.5 pt glossary text; its PDF preview is independently laid out and must not be represented as a certified rendering of Word pagination.
- The user authorized integrating logo option 04 into the application and using another gallery variant where needed. The source PNGs have opaque backgrounds and large canvas margins: preserve the originals and fit their visible artwork deliberately rather than shrinking the whole padded canvas into a navigation bar.
- Branding changes must be checked with the mobile dashboard menu open: taller artwork can move navigation beneath the fixed coach launcher. Use the compact option 06 in narrow dashboard headers; show the Sidebar navigation without a duplicate TopBar link group while that mobile menu is open.

## 2026-10-16 — onboarding lessons

- Use source/schema as authority where narrative docs disagree: Riot uses direct fetch; ingestion stores the linked participant plus teammate records; weakness evidence contains participant UUIDs. The technology map and feature trace cite the authoritative symbols.
- Verify backend commands against disposable PostgreSQL. Test setup applies migrations and tests write fixtures; run schema generation in a temporary copy when code changes are outside scope.
- Distinguish automated integration coverage from real service delivery. Passing mocked provider tests, registration, or a health endpoint does not establish live Riot/LLM/email/client behavior.
