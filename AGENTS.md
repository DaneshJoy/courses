# Teaching Hub portal agent instructions

## Scope and source of truth

Before editing, list the intended files and keep changes inside the assigned
scope. Preserve unrelated work; do not reset, clean, or overwrite it.

Read sources in this order:

1. `README.md` for portal use and commands.
2. `docs/registry.md` and `schemas/` for the registry/manifest contract.
3. `ARCHITECTURE.md` in the workspace root and
   `../AI-Teaching-Hub-spec-v2.md` for hub decisions.
4. Existing source and tests for implementation details.

Use the smallest correct change. Inspect callers before changing shared code.
Run `npm run check` for portal changes unless the task explicitly cannot run it.

## Portal rules

- `data/courses.json` is the canonical catalog registry; never hardcode course
  cards or course-specific UI logic.
- `generated/**` and `dist/**` are generated. Never edit them by hand.
- The catalog generator fetches published manifests at build time; runtime code
  must not fetch course manifests.
- Preserve RTL-first behavior. Use CSS logical properties instead of `left`,
  `right`, or physical horizontal margin/padding properties.
- Treat manifest text as untrusted text, not HTML.

## Course-template rules (forward-looking)

This repository currently contains the portal only: `data/`, `schemas/`,
`scripts/`, `src/`, workflow, and documentation. It does not contain a course
template or authoring pipeline. When a separate course template exists, its
ownership contract is:

- Authored: `content/**` and `course.json` may be edited when requested.
- Generated: `generated/**` and `dist/**` are never hand-edited.
- Template-owned: template paths such as `src/layouts/**`,
  `src/components/**`, `scripts/**`, and workflows change only through a
  template update.

Each course remains an independent sibling repository named `<course-id>`;
never place it under this portal repository.
