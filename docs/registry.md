# Course Registry

`data/courses.json` is the portal's only build-time input. It is a JSON array of
course entries; an absent course is simply not listed.

## Registry entry

```json
{
  "id": "ai-foundations",
  "manifestUrl": "https://example.github.io/ai-foundations/course.json",
  "status": "published",
  "featured": false
}
```

| Field         | Required | Rules                                                              |
| ------------- | -------- | ------------------------------------------------------------------ |
| `id`          | yes      | Lowercase ASCII slug (`^[a-z0-9]+(-[a-z0-9]+)*$`); unique. Persian only in titles, never IDs/URLs. |
| `manifestUrl` | yes      | Absolute HTTPS URL of the course's `course.json`.                  |
| `status`      | yes      | `published`, `unlisted`, or `archived`. Only `published` is fetched into the catalog. |
| `featured`    | no       | Boolean; optional display hint, carried into the catalog course when true. |

The schema is `schemas/course-registry.schema.json`; duplicate IDs are rejected
by the generator because JSON Schema cannot express uniqueness across array
items.

## Course manifest (`course.json`)

Each published course repo ships a manifest validated against
`schemas/course-manifest.schema.json`. Required fields: `id`, `title`,
`description`, `language`, `dir` (`rtl` | `ltr`), `level`, `category`, `tags`
(array, may be empty), `lectures` (each `{id, title, order, durationMinutes,
objectives, status}` with `status` = `draft` | `review` | `published`),
`schemaVersion` (`"1.0.0"`), `templateVersion`, `license`, and `updatedAt`.

A published manifest must declare at least one lecture, its `id` must match the
registry entry, and lecture `id`s and `order` values must be unique within the
manifest (React keys/order depend on them).

Custom format subsets accepted by the validator:

- `language`: primary subtag of 2–3 ASCII letters plus optional 2–8 character
  alphanumeric subtags (`fa`, `fa-IR`, `en`, `zh-Hant-TW`). Not full BCP-47.
- `updatedAt`: `YYYY-MM-DD` or a full date-time with `Z`/offset
  (`2026-10-28T10:00:00Z`). Not week/ordinal ISO forms.

## Generated artifacts

`npm run generate-catalog` (also run by `npm run build`) validates the registry
and every published manifest, then writes, under `generated/`:

- `catalog.json`: `{ "schemaVersion", "generatedAt", "courses": [manifest...] }`
  — a later Phase-1 task will import this at build time; the app never fetches
  manifests at runtime. A course from a `featured: true` entry gains
  `featured: true`.
- `search-index.json`: `{ "schemaVersion", "generatedAt", "courses": [{id,
  title, description, tags, lectures: [{id, title, order}]}] }`.
- `README.md`: generation marker. Never hand-edit these files.

`npm run validate` performs the same checks without writing artifacts.

## Failure policy

If any `published` entry has an unreachable or schema-invalid manifest, the
generator prints `course "<id>": <reason>`, exits non-zero, and the build fails.
Non-published entries are skipped and printed with their status.
