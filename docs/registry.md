# Course registry and manifest contract

`data/courses.json` is the canonical registry for the portal. Add a course by
adding one registry entry; do not hand-edit the generated catalog.

## Registry entry

```json
{
  "id": "ai-bme-intro",
  "manifestUrl": "https://example.github.io/ai-bme-intro/course.json",
  "status": "published",
  "featured": false
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `id` | yes | Unique lowercase ASCII slug: `^[a-z0-9]+(-[a-z0-9]+)*$`. Use Persian in text fields, not IDs or URLs. |
| `manifestUrl` | yes | Absolute HTTPS URL to the course's `course.json`. |
| `status` | yes | `published` is fetched and included in the public catalog; `unlisted` and `archived` are skipped by the generator. Archiving/removing an entry does not delete its course repository or site. |
| `featured` | no | Boolean metadata copied to a published manifest when `true`; the current UI does not yet provide featured sections. |

The registry schema is `schemas/course-registry.schema.json`. The generator
also rejects duplicate IDs.

## `course.json`

Every later course repository publishes `course.json`, validated against
`schemas/course-manifest.schema.json`. Required fields are `id`, `title`,
`description`, `language`, `dir` (`rtl` or `ltr`), `level`, `category`, `tags`,
`lectures`, `schemaVersion` (`"1.0.0"`), `templateVersion`, `license`, and
`updatedAt`.

Each lecture requires `id`, `title`, `order`, `durationMinutes`, `objectives`,
and `status` (`draft`, `review`, or `published`). A published course must have
at least one lecture; lecture IDs and order values must be unique. The manifest
ID must match its registry ID.

`language` accepts a practical subset of BCP-47 tags, not full BCP-47: current
accepted examples are `fa`, `fa-IR`, `en`, and `zh-Hant-TW`; the schema may
reject other forms that are valid BCP-47. `updatedAt` accepts `YYYY-MM-DD` or an
ISO date-time with a `Z` or numeric offset.

## Generation and failure behavior

`npm run validate` validates the registry and fetches/validates every
`published` manifest without writing output. `npm run generate-catalog` (run by
`npm run build`) writes these ignored artifacts under `generated/`:

- `catalog.json`: version, generation timestamp, and validated course manifests
  (including `featured: true` when requested).
- `search-index.json`: the compact build-time search data.
- `README.md`: a generated-file marker.

If a published manifest is unavailable, invalid, mismatched, or has invalid
lecture uniqueness, validation fails with the course ID and the build fails.
Non-published entries are logged as skipped. The static application uses the
generated catalog and does not fetch manifests at runtime.

Course repositories are independent sibling directories named `<course-id>`
(for example, `ai_bme_intro` locally), never directories inside `courses/`.
Local repository and directory names are conventions only; registry and
manifest `id` values must remain hyphen slugs (`^[a-z0-9]+(-[a-z0-9]+)*$`) and
may differ from the directory name.
This portal has no course template or authoring pipeline yet; this document
describes only the manifest contract it already validates.
