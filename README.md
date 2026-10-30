# Teaching Hub portal

The Teaching Hub portal is a static, Persian/RTL-first course discovery site
for the [DaneshJoy courses organization](https://github.com/DaneshJoy/courses).
It is built with React, TypeScript, and Vite, and is published at
https://daneshjoy.github.io/courses/.

It currently provides a landing catalog with Persian-aware search and filters,
theme switching, RTL support, and loading, empty, and error states. The canonical
registry is `data/courses.json`; published course manifests are loaded at build
time. Course detail pages, featured/recent sections, learning paths, and a
course-site template are not part of this initial portal skeleton.

## Local development

Node 24 is required (`.nvmrc` records the version). Install dependencies with:

```sh
npm ci
npx playwright install chromium
```

`npx playwright install chromium` is needed locally for the Playwright part of
the test suite. CI installs Chromium with its system dependencies.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite using the latest generated catalog (remote manifests are not fetched by the dev server). |
| `npm run dev:local` | Generate from local course manifests in strict offline mode, then start Vite. |
| `npm run generate-catalog` | Fetch and validate published remote manifests, then write generated artifacts. |
| `npm run generate-catalog:local` | Validate local manifests and write generated artifacts without network access. |
| `npm run validate` | Validate the registry and published remote manifests without writing files. |
| `npm run validate:local` | Validate local manifests without network access or output writes. |
| `npm run build` | Generate from remote manifests, type-check, and build `dist/`. |
| `npm run build:local` | Generate from local manifests in strict offline mode, type-check, and build `dist/`. |
| `npm run test` | Run Vitest and Playwright tests. |
| `npm run check` | Run remote validation, build, and tests. |
| `npm run check:local` | Run local validation, build, and tests. |

After a fresh clone, run `npm run generate-catalog` (or `npm run build`) before
`npm run dev`: `generated/` is gitignored, so the catalog artifacts do not exist
until the generator writes them.

Vite uses `PORTAL_BASE` for its base path and defaults to `/courses/`:

```sh
PORTAL_BASE=/courses/ npm run build
```

For offline development beside local course repositories, add `localPath` to
each published registry entry and use `npm run dev:local`. `localPath` is
resolved relative to the portal directory (or may be absolute) and points to the
course's `course.json`; for example, `../ai_bme_intro/course.json`. Strict local
commands fail if any published course has no readable local manifest. They do
not fall back to the network. Normal validation/build/deployment ignores
`localPath` and uses the HTTPS `manifestUrl`.

## Catalog data

`data/courses.json` is the canonical registry. Normal validation/build fetches
each published entry's HTTPS `manifestUrl` and validates it. Strict local
commands instead read the entry's `localPath`. Both modes validate manifests
against the same schema and write `generated/catalog.json` and
`generated/search-index.json`; the runtime application imports those artifacts
and never fetches course manifests.

See [docs/registry.md](docs/registry.md) for the registry and manifest contract.
Do not edit `generated/` or `dist/` by hand.

## Deployment

`.github/workflows/deploy.yml` deploys the static `dist/` artifact to GitHub
Pages on pushes to `main`, manual dispatches, and a daily schedule. Deployment
runs the normal remote build from `manifestUrl`; `localPath` is ignored.

## Related repositories

The portal repository is `DaneshJoy/courses`. Each future course is an
independent Git/GitHub repository, kept as a sibling directory named by its
course ID (for example, `../ai_bme_intro`), never nested inside this repository.
The portal consumes only the course's published `course.json` URL.
