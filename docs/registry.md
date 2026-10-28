# Course Registry

`courses/data/courses.json` is the portal's only build-time input. It is a JSON
array of course entries; an absent course is simply not listed.

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
| `featured`    | no       | Boolean; optional display hint.                                    |

The schema is `courses/schemas/course-registry.schema.json`; duplicate IDs are
rejected by the generator because JSON Schema cannot express uniqueness across
array items.

## Course manifest (`course.json`)

Each published course repo ships a manifest validated against
`courses/schemas/course-manifest.schema.json`. Required fields: `id`, `title`,
`description`, `language` (BCP-47), `dir` (`rtl` | `ltr`), `level`, `category`,
`tags` (array, may be empty), `lectures` (each `{id, title, order,
durationMinutes, objectives, status}` with `status` = `draft` | `review` |
`published`), `schemaVersion` (`"1.0.0"`), `templateVersion`, `license`, and
`updatedAt` (ISO 8601 date or date-time). A published manifest must declare at
least one lecture and its `id` must match the registry entry.

## Generated artifacts

`npm run generate-catalog` (also run by `npm run build`) validates the registry
and every published manifest, then writes, under `courses/generated/`:

- `catalog.json`: `{ "schemaVersion", "generatedAt", "courses": [manifest...] }`
  — the app imports this at build time; manifests are never fetched at runtime.
- `search-index.json`: `{ "schemaVersion", "generatedAt", "courses": [{id,
  title, description, tags, lectures: [{id, title, order}]}] }`.
- `README.md`: generation marker. Never hand-edit these files.

`npm run validate` performs the same checks without writing artifacts.

## Failure policy

If any `published` entry has an unreachable or schema-invalid manifest, the
generator prints `course "<id>": <reason>`, exits non-zero, and the build fails.
Non-published entries are skipped and printed with their status.
