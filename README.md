# Teaching Hub portal

The Teaching Hub portal is a static, Persian/RTL-first course discovery site
for the [DaneshJoy courses organization](https://github.com/DaneshJoy/courses).
It is built with React, TypeScript, and Vite, and is published at
https://daneshjoy.github.io/courses/.

It currently provides a landing catalog with Persian-aware search and filters,
theme switching, RTL support, and loading, empty, and error states. The
canonical registry is intentionally empty, so the deployed catalog has no
courses until published entries are added. Course detail pages, featured/recent
sections, learning paths, and a course-site template are not part of this
initial portal skeleton.

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
| `npm run dev` | Start the Vite development server. |
| `npm run validate` | Validate the registry and published manifests without writing files. |
| `npm run build` | Generate the catalog, type-check, and build `dist/`. |
| `npm run test` | Run Vitest and Playwright tests. |
| `npm run check` | Run validation, build, and tests. |

Vite uses `PORTAL_BASE` for its base path and defaults to `/courses/`:

```sh
PORTAL_BASE=/courses/ npm run build
```

## Catalog data

`data/courses.json` is the canonical registry. During validation/build, each
`published` registry entry has its remote `course.json` fetched and validated.
The generator writes `generated/catalog.json` and `generated/search-index.json`;
the runtime application imports those local artifacts and never fetches course
manifests.

See [docs/registry.md](docs/registry.md) for the registry and manifest contract.
Do not edit `generated/` or `dist/` by hand.

## Deployment

`.github/workflows/deploy.yml` deploys the static `dist/` artifact to GitHub
Pages on pushes to `main`, manual dispatches, and a daily schedule. The workflow
only runs its jobs for `main`, so changes on this `phase-1-skeleton` branch must
be merged into `main` before a push-triggered deployment occurs.

## Related repositories

The portal repository is `DaneshJoy/courses`. Each future course is an
independent Git/GitHub repository, kept as a sibling directory named by its
course ID (for example, `../ai_bme_intro`), never nested inside this repository.
The portal consumes only the course's published `course.json` URL.
