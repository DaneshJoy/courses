# Project: AI Teaching Hub (spec)

## 0. Product context 

- The author is a university teacher. All course content is **Persian (fa), right-to-left**, with embedded English technical terms, code, formulas and circuit/biomedical notation (LTR islands inside RTL text).
- Every decision below must be checked against this: Persian + RTL is a first-class requirement, not a later localization step.
- The author reviews and approves everything before publication. AI creates and validates; a human publishes.

## 1. Objective

Design and implement an AI-first teaching platform that publishes interactive educational courses as static websites on GitHub Pages.

The platform supports visually engaging web presentations, interactive learning components, simulations, quizzes and reusable educational content. Slides are one **view** of a lecture, not the whole product (see §6).

The system is optimized for AI-assisted creation, modification, validation and deployment rather than manual editing.

## 2. Repository Architecture

Two kinds of repositories:

1. `teaching-portal`: the course discovery website.
2. `course-<course-id>`: one independent repository per course.

Rules:

- Each course is independently buildable and deployable.
- The portal never depends on a course's internal source structure; it only consumes the published `course.json`.
- `course.json` contains `schemaVersion` and `templateVersion`, so course/portal/template compatibility is explicit and a shared component library can be introduced later without redesign.
- Course IDs are lowercase ASCII slugs (`feec`, `ai-bme`). Persian text is used only in titles/descriptions, never in IDs or URLs.
- During development, the AI works with both repositories as sibling folders in one working directory.

## 3. Teaching Portal

Responsive, modern, data-driven course discovery site. React + TypeScript + Vite.

Features, tagged by phase :

| Feature | Phase |
|---|---|
| Landing page with hero, course catalog, responsive cards | 1 |
| Search by title/description (Persian-aware, see below) | 1 |
| Filter by category, level, language, tags | 1 |
| Loading, empty, error states | 1 |
| Accessible navigation, light/dark themes, RTL-first layout | 1 |
| Featured and recently added courses | 2 |
| Course detail pages | 2 |
| Learning paths | 3 |

** Persian/RTL requirements for the portal**

- Use CSS logical properties (`margin-inline-start`, `inset-inline-end`, …) everywhere; no hardcoded `left`/`right`.
- Each course card renders with the direction of its own `language` (a Persian portal can list an English course).
- Search normalizes text before indexing and querying: unify Arabic/Persian letters (ي→ی, ك→ک), strip diacritics, treat ZWNJ (نیم‌فاصله) consistently, and map Persian/Arabic-Indic digits to one form. Client-side search index generated at build time.
- Fonts: self-hosted Persian font (e.g. Vazirmatn) with `font-display: swap`; no dependency on third-party font or script CDNs.

The UI is data-driven. No hardcoded course cards, no course-specific logic.

## 4. Course Registry

`data/courses.json` is the canonical registry.

Each entry contains:

- Stable course ID.
- Course manifest URL.
- `status`: `published` | `unlisted` | `archived`. Only `published` appears in the public catalog. Removing an entry or setting `archived` never deletes the course repo or its deployed site.
- Optional discovery/validation metadata (e.g. `featured`).

Each course publishes `course.json`. Define and document a versioned JSON Schema for it. Required fields include: `id`, `title`, `description`, `language` (BCP-47, e.g. `fa`), `dir` (`rtl`|`ltr`), `level`, `category`, `tags`, `lectures[]`, `schemaVersion`, `templateVersion`, `license`, `updatedAt`.

Build behavior:

- Validate every registry entry with Ajv.
- Fetch each published manifest at build time, validate it, and generate a local catalog artifact (`catalog.json` + search index). The published portal never fetches course manifests at runtime.
-  Failure policy: if a `published` course's manifest is unreachable or invalid, the portal build fails with a clear message naming the course. (Optional later: fall back to the last known-good snapshot.)
- Manifest text is treated as untrusted: rendered as text, never as raw HTML.
- The registry is the only file needing manual edits to add/remove a course.

**Keeping the catalog fresh.** Because the catalog is generated at build time, a course change must trigger a portal rebuild. Support, in this order of simplicity:

1. Portal workflow runs on `push`, `workflow_dispatch`, and a daily `schedule`.
2. Optional: course deploy workflow sends `repository_dispatch` to the portal using a fine-grained token stored in GitHub Secrets (never committed).

## 5. Course Repository Template

```
course.json
content/course-overview.md
content/syllabus.md
content/lectures/<lecture-id>/lecture.md
content/lectures/<lecture-id>/quiz.json      (optional)
public/
src/components/
src/layouts/
scripts/
tests/
.github/workflows/
AGENTS.md
```

Each lecture has: stable ID, title, order, estimated duration, learning objectives, `status` (`draft` | `review` | `published`). Only `published` lectures are built into the deployed site; drafts are visible only in local dev.

**Standard command contract.** Every course repo exposes the same npm scripts so an AI agent needs no course-specific knowledge:

`npm run dev`, `npm run validate`, `npm run build`, `npm run test`, `npm run check` (= validate + build + test).

**Course-site technology decision.** The course template uses Vite + TypeScript with framework-free components (custom elements / plain TS modules). React is **not** required in courses; this keeps courses light and the component API independent of the portal. (Revisit only with a concrete reason.)

**File ownership (documented in `AGENTS.md`).**

- *Authored* (AI may edit when asked): `content/**`, `course.json`.
- *Generated* (never hand-edited, regenerated by scripts, marked with a header comment): everything under `generated/` or `dist/`.
- *Template-owned* (change only via template update): `src/layouts/**`, `src/components/**`, `scripts/**`, workflows.
- The AI must list every file it intends to change before changing it and must not touch files outside the task's scope.

## 6. Content Format and Presentation System

### 6.1 Authoring format (previously missing)

Lectures are Markdown. Slides are separated by a defined marker (e.g. `---`). Interactive components are embedded with **directive blocks** that reference JSON:

```
:::quiz{src="./quiz.json" id="q1"}
:::

:::slider{param="R" min="1" max="100" step="1" label="مقاومت (Ω)"}
:::
```

- The build step parses Markdown + directives into a **presentation-independent intermediate representation (IR)** (JSON). Reveal.js is just one renderer of the IR. This is what keeps content independent of the presentation engine.
- Unknown directives, missing attributes and bad JSON are build errors with file and line.

### 6.2 Two views of the same lecture

- **Presentation view** (Reveal.js): for use in class.
- **Study view** (scrolling page, same content): for students; interactive components are fully usable here, with room to experiment.
- Optional: print stylesheet / `?print-pdf` handout export for students who still want a PDF.

### 6.3 Presentation features

Keyboard navigation, previous/next controls, slide overview, progress indicator, fullscreen, responsive layouts, code highlighting, accessible interactive elements, consistent styling, course/lecture navigation, optional last-slide persistence (localStorage, no tracking), speaker notes.

Shared behavior is implemented once. Lectures never implement navigation themselves.

### 6.4 Persian/RTL requirements for presentation 

- Reveal.js `rtl` option enabled for RTL courses; verify arrow-key/next-previous directions and progress bar direction in tests.
- Set `lang`/`dir` on `<html>` from `course.json`; allow `dir="auto"` / `<bdi>` for mixed fragments.
- Code blocks, formulas, units and circuit diagrams are forced `dir="ltr"` and left-aligned inside RTL slides.
- **Math**: KaTeX (self-hosted, build-time rendering where possible); formulas are LTR islands. Charts: axis labels and tooltips in Persian, numeric axes LTR.
- Typography: line height tuned for Persian, no italic for Persian text, ZWNJ preserved by the Markdown pipeline.
- Authoring conventions document (in `AGENTS.md`): which digits to use in prose (Persian vs Latin), English term in parentheses on first use, consistent technical glossary per course (`content/glossary.json`).
- `prefers-reduced-motion` respected; animations are minimal and purposeful.

## 7. Interactive Learning Components

Initial set: Quiz, Code block, Interactive chart, Parameter slider, Step-by-step explanation, Diagram, Simulation container, Callout/key concept, Expandable explanation,  Math (KaTeX).

Rules:

- Use interaction only when it improves learning; not every slide is interactive.
- Each component has a documented input format (JSON Schema), predictable behavior and error handling that fails visibly (an error box on the slide in dev, a safe fallback in production), never a blank slide.
- Simulation container: custom JS runs inside a sandboxed `iframe` (`sandbox` attribute, no network). Simulation code from AI is reviewed before publish.
- Quiz answers are shipped in the static JSON and are therefore visible to students. Quizzes are formative, not for grading. This is documented.
- Avoid unnecessary dependencies and excess animation.

## 8. AI-First Content Workflow

An AI agent can: create a course from a specification → generate syllabus → lecture metadata → modular lecture content → quizzes and demos → build → validate → test → prepare for deployment.

- Small, logically organized files; deterministic generation and validation.
- Ownership/regeneration rules as in §5. No silent overwrites.
- **Human review gate.** The AI works on a branch and opens a pull request. Deployment to GitHub Pages runs only from `main` after the author merges. The content-review checklist (§9) is part of the PR template.

## 9. Validation and Testing

Automated checks:

- JSON Schema validity (manifest, registry, quizzes, component inputs).
- Unique course and lecture IDs.
- Required metadata; `status` values.
- Missing assets, invalid internal links, missing lecture content.
- Build errors.
- Quiz sanity: exactly the declared number of correct answers, correct option IDs exist.
- Broken navigation, JavaScript console errors.
- Responsive layout: at defined viewports (e.g. 375, 768, 1280) assert no horizontal overflow and no clipped content; do not rely on brittle pixel-snapshot tests.
- Accessibility: axe-core via Playwright on key pages in light and dark themes, plus keyboard-navigation tests.
- RTL checks: `dir`/`lang` set correctly, Persian font loaded, code/formula blocks are LTR, navigation direction correct.
- Interactive component behavior (Playwright).

A failed required validation blocks deployment.

Successful HTML generation is not proof of scientific correctness. A separate human **content-review checklist** covers: factual accuracy, scientific terminology (Persian and English), units, formulas, citations and image licenses, and instructional quality.

## 10. Deployment

GitHub Actions + GitHub Pages. Each course and the portal have independent workflows.

Workflows: install reproducibly (`npm ci`, committed lockfile, pinned Node version), validate, build, test, publish only validated output.

- Correct project-site base paths (`/<repo-name>/`). Use Vite `base` from an environment variable; no root-relative asset URLs.
- All assets (fonts, scripts, KaTeX, Reveal.js) are bundled and self-hosted: no runtime third-party CDN, so the site works reliably regardless of network restrictions on external services.
- No secrets in the repository. Tokens only in GitHub Secrets.
- No server-side runtime.

## 11. Design System

Modern editorial style: strong typography, clear hierarchy, generous spacing, restrained color, high-quality diagrams, accessible contrast, light and dark themes, consistent interaction patterns. Reusable design tokens (CSS variables) shared by portal and course template.

Designed RTL-first: the Persian typeface drives the type scale; Latin text is chosen to pair with it. Avoid generic AI-looking pages (heavy gradients, decorative cards, gratuitous animation).

## 12. Technology Constraints

- Portal: React, TypeScript, Vite.
- Course template: Vite, TypeScript, framework-free components.
- Reveal.js (version pinned) as the initial presentation renderer.
- Markdown + directives for lectures; JSON for metadata and quizzes; JSON Schema + Ajv for validation.
- KaTeX for math.
- GitHub Actions, GitHub Pages, Playwright (+ axe-core).
- Additional libraries only with clear value.

## 13. Documentation

Root README (architecture), setup/local development, course creation, course removal/archival, authoring conventions (including Persian typography rules), component documentation, deployment, troubleshooting, AI agent instructions. Exact commands to validate, build, test and deploy a course.

## 14. Implementation Strategy

Work incrementally; a tested vertical slice beats a large incomplete framework. No dozens of placeholder files.

**Phase 0 (before coding)** : inspect the repository; list required files and open decisions; produce a concise plan; wait for approval.

**Phase 1: vertical slice** 
- Schemas (`course.json`, registry) and the Markdown directive format / IR.
- Portal shell with registry, build-time catalog, Persian-aware search, RTL, dark/light.
- One representative course (about 2 lectures) with Persian content, formulas, one quiz and one interactive visualization.
- Reusable presentation layout (Reveal.js, RTL) + study view.
- **Minimal validation in Phase 1** (Ajv schemas, unique IDs, missing assets, build) and a Playwright smoke test (no console errors, RTL set, navigation works). Without this, AI-generated content has no safety net.
- GitHub Pages deployment for both repos, including base paths.

**Phase 2**
- Full validation suite and browser tests, accessibility (axe), responsive checks.
- Course registration workflow, catalog refresh triggers, PR review template + content checklist.
- Featured/recent courses, course detail pages, print/PDF handout.
- Document AI-assisted course generation.

**Phase 3**
- Extract shared components into a versioned library if justified (watch for drift between course copies).
- More component types, learning paths, optional progress tracking, improved discovery.

**Final report must include:** implemented features; repository structure; local development commands; validation and test results; GitHub Pages deployment instructions; known limitations; recommended next steps.
