# Task 4 implementation report — instructor offline portal package

## Status

Complete and committed on `offline-packaging` as `221fc25 feat: package instructor portal offline`.

## Scope and changed files

- `.gitignore`
  - Ignores `offline/` and deterministic `.offline-staging/` assembly output.
- `package.json`
  - Adds `package:offline`.
  - Runs the package-assembly Node tests as part of the existing test command.
- `scripts/generate-catalog.cjs`
  - Adds narrowly scoped `PORTAL_PACKAGE=1` catalog URL mode.
  - In that mode only, emitted card URLs are `courses/<registry-id>/`; existing remote URLs and `PORTAL_LOCAL=1` manifest source behavior remain unchanged.
- `scripts/create-zip.py`
  - Archives staging contents relative to staging, preventing a staging-directory ZIP prefix.
- `scripts/package-offline.cjs`
  - Recreates only `.offline-staging/`.
  - Reads the canonical registry, selects published courses, resolves each existing `localPath`, invokes its offline-aware build (`build:offline` when supplied, otherwise `build`), and copies its `dist/` to `courses/<registry-id>/`.
  - Builds the portal with `PORTAL_LOCAL=1`, `PORTAL_PACKAGE=1`, and `PORTAL_BASE=./` (the local setting comes from `build:local`).
  - Copies portal `dist/` to the staging root and creates `offline/teaching-hub-instructor.zip`.
  - Names the registry course in errors for missing source configuration/build output.
- `tests/catalog.test.ts`
  - Covers local-manifest, no-network package catalog generation and package-relative URLs.
- `tests/package-offline.test.cjs`
  - Covers injected command execution and filesystem assembly, required environment/commands, expected staging layout, root-level ZIP arguments, and named missing-build failure.

`vite.config.ts` was inspected but required no change: its existing `process.env.PORTAL_BASE ?? "/courses/"` already honors the package assembly `PORTAL_BASE=./` contract.

## TDD evidence

1. Added the catalog package-mode test before implementation.
2. Ran `npx vitest run tests/catalog.test.ts`; it failed as intended because it received `https://example.com/` instead of `courses/ai-foundations/`.
3. Implemented the minimal `PORTAL_PACKAGE=1` URL branch and reran successfully.
4. Added the package-assembly tests before the assembly implementation; the first run failed with `Cannot find module '../scripts/package-offline.cjs'`.
5. Implemented the scripts, then corrected the temporary fixture path after the test surfaced the expected missing-dist error. Final focused package tests pass.

## Verification

| Command | Outcome |
| --- | --- |
| `npm ci` | Passed; 54 packages installed, 0 vulnerabilities reported. |
| `npx vitest run tests/catalog.test.ts` | Passed: 15 tests. |
| `node --test tests/package-offline.test.cjs` | Passed: 2 tests. |
| `npm run check:local` | Passed: local validation, local Vite build, 58 Vitest tests, 2 Node package tests, and 1 Playwright smoke test. |
| `npm run package:offline` | Passed; produced `offline/teaching-hub-instructor.zip`. |
| Python ZIP inspection | Passed: 205 entries; contains root `index.html` plus all three `courses/<id>/index.html` roots; no `.offline-staging/` prefix. |
| `git diff --check` | Passed before commit. |

## Archive evidence

The generated instructor archive contains:

- `index.html`
- `courses/ai-bme-intro/index.html`
- `courses/machine-learning/index.html`
- `courses/statistical-pattern-recognition/index.html`

Portal catalog URLs in the package build are relative `courses/<id>/`, so card destinations resolve within the extracted archive.

## Self-review

- The registry/schema and `PORTAL_LOCAL=1` behavior were not modified.
- No dependencies were added.
- Generated and ignored `generated/`, `dist/`, `offline/`, and staging output were not committed.
- Assembly deletes only its dedicated staging directory and overwrites its one archive; it does not clean sibling source worktrees or unrelated paths.
- Course builds use their offline-specific build script if exposed (`ai_bme_intro`); other sibling repositories use their existing build command, matching their package implementation.

## Concerns / residual risks

- The requested Windows direct-`file://` manual browser acceptance is environment-specific and was not run here.
- The `ai_bme_intro` Vite build emits an existing chunk-size warning (>500 kB); it does not fail the build or packaging.
- This portal package requires Node/npm and Python 3 to assemble, as allowed by the task brief.

## Round 1 review fixes — 2026-11-09

- `tests/package-offline.test.cjs` now creates each sibling-course fixture in its own `mkdtempSync` directory, uses an absolute `localPath`, and removes both fixture and portal roots through `try`/`finally` cleanup. The prior shared `/tmp/ai-foundations` and `/tmp/missing` fixtures were removed; a clean focused test run leaves neither path behind.
- `scripts/package-offline.cjs` now prefixes sibling `package.json` read failures and sibling build-command failures with `course "<id>":`, while retaining the original error as the cause.
- The failing-build test now asserts that `missing-course` is present in the thrown message.

| Command | Outcome |
| --- | --- |
| `node --test tests/package-offline.test.cjs` | Passed: 2 tests; verified no `/tmp/ai-foundations` or `/tmp/missing` remained afterward. |
| `npx vitest run tests/catalog.test.ts` | Passed: 15 tests. |
| `git diff --check` | Passed. |
