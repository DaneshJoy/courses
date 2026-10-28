# Teaching Portal Agent Instructions

## Refined Instruction

Read this file before changing code. Treat it as living project guidance: keep
durable decisions, preferred patterns, verification commands, and lessons that
will help future agents. Improve it when a new decision is reusable across
sessions or sprints. Do not store temporary thoughts, session narration,
secrets, credentials, or task-specific noise here.

Use the repository's current `README.md` and `ARCHITECTURE.md` as
approved project guidance.

Prefer the smallest correct change.

## Source Of Truth

Read in this order:

1. `README.md` for public project shape and overview.
2. `ARCHITECTURE.md` for boundaries, ADRs, and graph decisions.
5. Existing source and tests for exact implementation patterns.

## Engineering Rules

- 

## Codebase Navigation

- Use codebase-memory graph tools first for symbols, callers, callees, routes,
  and architecture.
- Call `check_index_coverage` for every source path used as evidence or changed.
- Treat clean coverage as best-effort, not proof of completeness.
- Fall back to `grep`/`glob` for literals, configs, docs, and graph misses.
- Read exact source before making material claims or edits.
- After substantial external edits, refresh or verify index status before relying
  on graph results.

## Git And Agent Workflow

- Check `git status` before editing. Preserve unrelated changes; never reset,
  checkout, or clean user work without explicit approval.
- Review each subagent task for both spec compliance and code quality before
  moving to dependent work.
- Keep a task ledger in `.superpowers/sdd/<plan-name>/progress.md` so progress
  survives context compaction.
- Subagents receive one scoped brief, exact interfaces, relevant coverage
  evidence, and a report-file path. They must commit their task and report test
  commands plus output.
- Never dispatch multiple implementation agents concurrently when they edit
  shared workspace files.
- Review fix rounds with a scoped diff; do not fix review findings silently in
  the controller session.

## File Maintenance

Update this file when any of these become durable:

- architecture or source-of-truth decisions;
- new project-wide contract or naming convention;
- agent workflow lesson that prevents recurring errors.

### Keeping ARCHITECTURE.md and README.md current

Keep additions concise. Remove rules when architecture deliberately changes.
Record the reason for meaningful changes in the commit message, not in this
file's history section.
