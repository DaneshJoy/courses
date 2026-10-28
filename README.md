# Courses Portal

Static, data-driven course-discovery portal (Vite + React 19 + TypeScript).
Persian/RTL-first; the app will render from build-time generated catalog data
(wiring lands in a later Phase-1 task) and never fetches course manifests at
runtime.

## Commands

- `npm run dev` — local dev server
- `npm run validate` — validate the course registry and every published manifest
- `npm run generate-catalog` — validate and write `generated/catalog.json` + `generated/search-index.json`
- `npm run build` — generate catalog, type-check, build
- `npm run test` — Vitest unit tests
- `npm run check` — validate + build + test

## Course registry

`data/courses.json` is the canonical registry (empty until courses are
published). Entry fields, manifest requirements, generated artifact shapes, and
the build failure policy are documented in [docs/registry.md](docs/registry.md).
Schemas live in `schemas/`. Anything under `generated/` is generated at build
time and must never be hand-edited.

## Browser tests

Install the browser locally or in CI before running the Playwright smoke test:
`npx playwright install chromium`.
