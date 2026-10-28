# Architecture

The Beautifiers AI Core began as a mocked skeleton: a working linear flow with
every business concern stubbed. The decision layer has since been decomposed
into four contracts and the graph reshaped around them — see ADR-005 and
ADR-006 below, and [`FLOW.md`](FLOW.md) for the current sequence.

This document describes the pieces as they stand today and how they evolve into
the fuller multi-agent platform.

## 1. Orchestration (LangGraph)

`apps/orchestrator/` defines a typed state machine.

- **State** — `AgentState` (`apps/orchestrator/state.py`) carries `user_id`,
  `session_id`, `media_urls`, `memory_context`, and `agent_outputs` (a
  per-node envelope). It is a Pydantic model, so it is fully typed and
  serializable at every graph hop.
- **Nodes** — one async function per step in
  `apps/orchestrator/nodes.py`. Decision-path nodes run real deterministic
  logic over real profile data; layer agents remain structured mocks.
- **Flow** — `build_graph()` wires a linear lead-in, a four-way parallel
  fan-out, and a linear tail:

  ```text
  memory → advisor → constraints → beauty_plan
         → {surgical, semi_invasive, cosmetic, dental}
         → layer_control → composer → treatment_spec → ai_case_persist → vision_invoke → END
  ```

  (`apps/orchestrator/graph.py`; see ADR-006 for how this replaced the
  original strictly linear chain.)
- **Entrypoint** — `run_orchestration(initial_state, session_id)` compiles and
  executes the graph, returning the final `AgentState`.

### Evolution

`agent_outputs` is a dict keyed by node name, so future sprints can:
- extend the existing **parallel fan-out** stage (the four transformation
  layers already run concurrently under a merging reducer);
- attach **real agent embeddings** behind each node without changing the API;
- add **layered image generation** as new nodes/edges in the graph.

## 2. Memory

`memory/` exposes a narrow async interface, `MemoryInterface`:

```python
save_memory(user_id, data)
read_memory(user_id) -> dict
update_memory(user_id, data)
search_memory(user_id, query, top_k=5) -> list[dict]
```

`MockMemory` implements it with an in-process dict and static dummy profiles.
Orchestration and the API depend only on the interface.

### Evolution

A real backend implements the same interface:
- **Qdrant** for vector search over memory entries (`search_memory` becomes
  cosine similarity);
- **Mem0** for agent/chat conversational memory on top of store/update.

Dependency injection swaps the mock for the backend with no changes to callers.

**Caveat resolved:** services — including memory — are provided through FastAPI
`Depends` providers in `apps/beauty_advisor/dependencies.py`. The early
module-level-singleton instantiation is gone; backend swaps are overrideable at
the dependency level.

## 2a. Entitlement consumption boundary

`entitlement/` is ai-core's consumption-side view of the Best Face entitlement
issued by Financial Core. The `EntitlementProvider` protocol resolves a user's
`Entitlement` (mock provider stands in for Financial Core); the API wires it
through `Depends` (`get_entitlement_provider`, a cached singleton) as a gate on
`POST /chat` that runs before any orchestrator node. ai-core never issues,
prices, or mutates entitlements, and no per-layer entitlement concept exists —
the entitlement covers the whole Best Face process across all four layers.

Access-source attribution lives in the same `entitlement/` module: at session
entry `POST /chat` records either a `ReferralAttribution` (referral code) or a
`CorporateAccessRecord` (corporate code) into `AttributionStore` (a cached
process-lifetime in-memory store, overridable through `Depends` like the rest).
The record types are structurally separate — a corporate entry is never a
referral — and both are fact-only records. No economic value or money figure
exists anywhere in `entitlement/`; referral and corporate economics are owned by
Financial Core.

## 2b. AI Case persistence boundary

`ai_case/` defines the persistence boundary toward beautifiers-app: the
`AiCasePersistenceAdapter` protocol exposes a single `create_ai_case(payload)`
method — the Day 1 `AiCasePersistencePayload` (contract v1.0.0) is atomic, so
case metadata, version lineage, the embedded `TreatmentSpecification`, and the
run record travel in one envelope. `MockAiCasePersistenceAdapter` (in-memory,
the default) and `HttpAiCasePersistenceAdapter` (stdlib-urllib POST, injectable
transport) implement it, and the orchestrator's terminal `ai_case_persist` node
depends only on the protocol: the adapter arrives on `AgentState` via
`get_ai_case_adapter` (a cached `Depends` singleton, overrideable like the
rest). `correlation_id` is a client-generated correlation key — beautifiers-app
assigns the canonical AI Case ID. No DB driver exists in ai-core, and the HTTP
endpoint contract is aligned to the accepted beautifiers-app ADR-017 intake,
including the dedicated `X-AI-Core-Service-Token` service header and a bounded
retry policy; it is not yet exercised against a live instance because the
backend's inbound guard is still pending (owner Kabiri); see ADR-007 and
ADR-011.

## 2c. Vision invocation boundary

`vision/` defines the invocation boundary toward beautifiers-ai-vision: the
`VisionInvocationAdapter` protocol exposes a single `transform(spec)` method —
the pipeline hands the built v2 `TreatmentSpecification` to the adapter and
keeps the provisional `VisionTransformationResult` (invocation envelope v1) on
`AgentState`. Only a deterministic `FixtureVisionAdapter` implements it (the
default via `get_vision_adapter`, a cached `Depends` singleton, overrideable
like the rest); the terminal `vision_invoke` node sits after `ai_case_persist`,
so an AI Case is persisted before any vision failure can affect it, and it
skips the call entirely when the specification has no treatments. No vision
dependency, transport, endpoint, or auth exists in ai-core: vision WILL be a
network service (OQ-A) but its invocation contract is undefined, and the
transformation/validation vocabulary belongs to vision's
`AICaseTransformationRecord` (OQ-10) — the envelope grows only when that is
signed; see ADR-008.

## 3. Event bus

`events/` defines typed domain events inheriting a base `BeautyEvent` with
`user_id`, `session_id`, `timestamp`. The active decision-path events are
`ProfileUpdated`, `ConstraintEvaluated`, `BeautyPlanCreated`,
`TransformationCompleted`, and `LayerComposed`; events left over from the
original skeleton (`FaceCompleted`, `SkinCompleted`, `ProviderMatched`,
`ReservationCreated`) remain defined but unpublished.
`EventBus` is an in-memory async pub/sub (`publish`, `subscribe`), and each
orchestrator node publishes its own event onto it.

### Evolution

The same events are re-emitted to a real broker (Kafka/RabbitMQ) through a
`Publisher`/`Subscriber` adapter. Consumers subscribe to the event types they
care about; the payload schemas stay the same.

## Scope note

Real provider matching/reservation, real LLM calls, real image generation,
real medical/legal rule data beyond the platform-defined rule set, persistent
backends, and broker integration remain out of scope. Adapter seams toward
beautifiers-app (AI Case persistence) and vision now exist with mock/fixture
defaults — the HTTP persistence shape is aligned to the accepted beautifiers-app
ADR-017 intake but is not yet exercised against a live instance (the
backend's inbound service-token guard is still pending, owner Kabiri), and
vision's invocation contract is undefined (OQ-A); there are no live
integrations. The decision layer is
implemented as real deterministic logic; the edges around it stay mocked until a
later sprint explicitly adds them.

---

# Architecture Decision Records

ADRs record decisions that shape the codebase and the reasoning behind them, so
later sprints can tell an intentional constraint from an accident. ADR-005 is
the first record written down; 001–004 cover early skeleton decisions that were
made implicitly and are noted here in brief for continuity.

- **ADR-001** — Orchestration uses LangGraph with a typed Pydantic `AgentState`.
- **ADR-002** — Memory is accessed only through the abstract `MemoryInterface`,
  so a Qdrant/Mem0 backend is a drop-in replacement.
- **ADR-003** — Domain events are typed Pydantic models on a shared
  `BeautyEvent` base, delivered by an in-memory `EventBus`.
- **ADR-004** — The skeleton kept the graph strictly linear; parallel fan-out
  was deferred until there were agents worth running concurrently.

## ADR-005 — Decompose the DecisionEngine into four contracts

**Status:** Accepted

### Context

The platform's "brain" was originally sketched as a single `DecisionEngine`
component. No such class was ever committed — the initial skeleton shipped the
linear orchestrator only — so this decision was taken before any code existed
to refactor.

A single engine would have owned four unrelated responsibilities: deciding what
a user is *allowed* to be shown, deciding what to *suggest*, *fusing* per-layer
results, and deciding which layers the client actually *wants*. Those change for
different reasons and on different schedules. Legal and medical filtering in
particular is a compliance surface: it must be auditable in isolation, and it
must not be possible to reach a generation agent without passing through it.

### Decision

Decompose into four contracts, one responsibility each:

| Contract | Module | Responsibility |
|---|---|---|
| `ConstraintEngine` | `constraints/` | **Gatekeeping.** Combines user preference, medical/legal constraint, and beauty reference rule into an `allowed` / `restricted` / `rejected` decision. |
| `BeautyPlan` | `beauty_plan/` | **Planning.** Assembles the per-layer advisory plan from profile, constraint decisions, and agent outputs. |
| `MasterBeautyComposer` | `composer/` | **Fusion.** Merges available per-layer results into one `FinalTreatmentPlan`; tolerates any layer being absent. |
| `LayerControlService` | `layers/` | **Presentation-layer control.** Filters the four layers down to the client-requested subset before composition. |

Gatekeeping is enforced structurally, not by convention: every layer agent takes
a required `ConstraintDecision` parameter, so invoking a generation agent without
a constraint decision is a type error rather than a review comment.

Layer filtering runs **before** composition. The composer receives `None` for
disabled layers rather than composing everything and discarding the unwanted
parts — cheaper, and it keeps "what the user asked for" out of the fusion logic.

### Consequences

- Four small contracts instead of one large one; each is independently mockable
  and independently testable.
- The compliance surface (`ConstraintEngine`) is auditable on its own.
- A subsequent sprint closed the deferred fusion gap. `MasterBeautyComposer.compose()`
  now receives `layer_results`, the `BeautyPlan`, and the relevant
  `ConstraintDecision`s, and returns a `FinalTreatmentPlan`. Composition keeps
  disabled-layer filtering upstream: `LayerControlService` supplies `None`,
  and the composer preserves those layers as unavailable rather than composing
  and discarding them afterward. Fusion is deterministic, resolving priority,
  confidence, invasiveness, requested-match, and stable treatment-ID ties while
  preserving compatible combinations. Rejected and unavailable treatments,
  plus conflict losers, are retained in `TreatmentExclusion` metadata with
  reasons, winning treatment IDs, and applicable conflict rule IDs. The
  orchestrator now passes the widened contract from `layer_control` to
  `composer` and stores the resulting final plan in state.
- More modules and more wiring than a single engine would need. Accepted: the
  boundaries are the point.

### Scope note

The delivered profile-derived planning, constraint decisions, and
deterministic beauty-plan/composer behavior are no longer placeholders. Real
medical/legal rule data and production generation models remain future work;
this ADR does not claim those integrations are implemented.

## ADR-006 — Graph A: drop analysis and booking nodes from the decision graph

**Status:** Accepted

### Context

The original skeleton graph was `memory → face → skin → makeup → provider →
reservation → llm → aggregator`. The target decision flow does not include
`face`, `skin`, `provider`, or `reservation`. Two options were considered: keep
the analysis nodes feeding the advisor (Graph B), or follow the target flow
literally (Graph A).

### Decision

Graph A. The decision graph is:

```
memory → advisor → constraints → beauty_plan
       → {surgical, semi_invasive, cosmetic, dental}   (parallel fan-out)
       → layer_control → composer → END
```

Node disposition from the original skeleton:

| Skeleton node | Fate |
|---|---|
| `memory` | kept |
| `face`, `skin` | removed from the graph; modules retained for a later sprint |
| `makeup` | renamed `cosmetic`, now a fan-out layer agent |
| `provider`, `reservation` | removed from the graph |
| `llm` | renamed `advisor` |
| `aggregator` | renamed `composer`, backed by `MasterBeautyComposer` |

### Consequences

- `POST /chat` no longer returns provider or reservation data. This was a
  breaking API change against the original skeleton.
- `face` and `skin` are parked, not deleted. Reintroducing them as a pre-advisor
  fan-out is a small change when real analysis models arrive.
- The four layer agents run concurrently, which requires a merge reducer on
  `AgentState.agent_outputs` — concurrent writes to one dict key raise
  `InvalidUpdateError` in LangGraph otherwise. This is the only non-trivial
  wiring in the decision-graph restructure.
- A later sprint appended a terminal `treatment_spec` node after `composer`
  (see `FLOW.md`); the graph above reflects the restructure as decided here.

## ADR-007 — AI Case persistence via swappable adapter

**Status:** Accepted

### Context

Sprint 5 Day 2: the mocked edges around the decision core are becoming
pluggable boundaries. Each orchestration run must produce an "AI Case" record
persisted by beautifiers-app, and the pipeline needs a seam for that
persistence that does not hard-code a transport or backend.

### Decision

Introduce `AiCasePersistenceAdapter`, a single-method protocol
(`create_ai_case(payload)`), with an in-memory `MockAiCasePersistenceAdapter`
(default) and an `HttpAiCasePersistenceAdapter` (stdlib `urllib` behind an
injectable transport; no new dependency). The protocol is deliberately
consolidated to one method because the Day 1 `AiCasePersistencePayload` is
atomic: it already carries the case metadata, the five version lineage fields,
the full embedded v2 `TreatmentSpecification`, and the complete run record. If
the confirmed beautifiers-app contract (OQ-B) later requires separate
endpoints, the protocol grows then. A terminal `ai_case_persist` graph node
(after `treatment_spec`) builds the payload from state and hands it to the
adapter resolved through `get_ai_case_adapter`; the pipeline depends only on
the interface, so swapping Mock → HTTP changes zero pipeline logic.

### Consequences

- `/chat` steps gain an `ai_case_persist` entry; `STAGE_ORDER` and the
  node-sequence assertions include it.
- The HTTP adapter is now aligned to the accepted beautifiers-app ADR-017
  intake (`POST /api/v1/ai/cases`, ids as `Idempotency-Key`/`X-Correlation-Id`
  headers, canonical id read from the response); see ADR-011. Service
  authentication uses the dedicated `X-AI-Core-Service-Token` header
  (Sprint 7 decision; backend guard still pending, owner Kabiri). The lineage
  int-mapping is directionally agreed with values open, and the attachment
  mapping is decided, but the second-call implementation — posting the spec
  as a `TREATMENT_SPECIFICATION` attachment in addition to `input.payload` —
  is deferred (owner Saeed + Kabiri). Swapping to HTTP is a
  dependency-override change.
- No DB driver exists in ai-core; persistence remains beautifiers-app's job.

## ADR-008 — Vision invocation via swappable adapter

**Status:** Accepted

### Context

Sprint 5 Day 3 (OQ-A): vision WILL become a network service (probably
dockerized), but the invocation contract — transport, endpoint, auth — is
undefined. Vision also consumes its own provisional placeholder specification,
not ai-core's v2 wire contract (OQ-D), and the real transformation/validation
vocabulary belongs to vision's `AICaseTransformationRecord` (OQ-10). The
pipeline still needs an invocation seam that does not presuppose how vision is
called.

### Decision

Introduce `VisionInvocationAdapter`, a single-method protocol
(`transform(spec)`), with a deterministic `FixtureVisionAdapter` as the only
implementation — no HTTP client and no vision dependency. Pipeline code depends
only on the interface; the adapter arrives on `AgentState` via
`get_vision_adapter` (a cached `Depends` singleton, overrideable like the
rest). A terminal `vision_invoke` node sits after `ai_case_persist`, so an AI
Case is persisted before any vision failure can affect it, and skips the call
when the specification has no treatments (rejected-only plans produce empty
specs). The provisional `VisionTransformationResult` envelope (v1) versions
only this seam.

### Consequences

- The transport/HTTP adapter arrives when OQ-A's contract is defined; swapping
  it in is a dependency-override change with zero pipeline edits.
- The result envelope grows only when OQ-10 signs the real
  `AICaseTransformationRecord` vocabulary.
- `/chat` steps gain a `vision_invoke` entry; `STAGE_ORDER` and the
  node-sequence assertions include it.
- Sprint 7: the real in-process `LibraryVisionInvocationAdapter`
  (`vision/library_adapter.py`) now exists behind the same protocol — it
  lazily imports the `ai_vision` package (dist `beautifiers-vision`, NOT a
  declared dependency; opt-in via `BEAUTIFIERS_VISION_PATH` on `sys.path`)
  and is injected per request, since the process-lifetime DI seam cannot
  supply the required per-request image and `version_lineage`. The default
  remains `FixtureVisionAdapter`. The envelope grew additively with
  `validation_status` (no schema-version bump). The full real path additionally
  depends on the vision repo's Patch A (`spec_id`/`provenance`/`generated_at`
  through the record) — pending, owner Behzadi.

## ADR-009 — Unified structured failure envelope with fail-fast boundaries

**Status:** Accepted

### Context

Sprint 5 Day 5 standardization. Failure responses were previously mixed:
500s surfaced raw string details, 422s kept FastAPI's default validation list,
and the 403 entitlement rejection was structured — three shapes for the same
concept. Exception text could leak to clients, and the vision seam had no
timeout backstop: a hanging adapter would hang the whole request.

### Decision

Every failure-matrix response answers with one flat envelope
`{"error", "reason", "details"}`, produced by a per-class exception handler:

| Status | `error` | Source |
|---|---|---|
| 422 | `request_validation_failed` | `RequestValidationError` handler (serializable `{type, loc, msg}` items) |
| 403 | `entitlement_required` | entitlement gate raising an envelope-carrying `HTTPException` |
| 500 | `internal_error` / `orchestration_incomplete` | catch-all `Exception` handler / incomplete-artifact guard |
| 502 | `vision_transformation_failed` | `VisionInvocationError` handler |
| 503 | `ai_case_persistence_failed` | `AiCasePersistenceError` handler |

- Envelope-carrying `HTTPException`s are flattened to the envelope as the
  response body. Legacy string `{"detail": ...}` shapes remain only for
  memory-404 and route-not-found (both shape-pinned by tests) and the
  `PATCH /profile` empty/no-change `ValueError` 422s (status-pinned).
- The vision seam wraps invocation in
  `asyncio.timeout(VISION_TIMEOUT_SECONDS)` (5.0s); a `TimeoutError` is
  converted to `VisionInvocationError` with a "timed out" reason.
- Persist-first ordering: the terminal `ai_case_persist` node precedes
  `vision_invoke`, so a vision failure never loses the persisted AI Case.
- A persistence failure retries only transient transport/5xx failures
  (bounded, with exponential backoff); any 4xx and response-shape failures
  surface immediately. Vision is never invoked when persistence failed.
- A partial layer failure fails the whole request; silent partial results are
  never returned.

### Consequences

- Clients get predictable failure behavior across the decision path.
- Adapter messages surface in `reason`, so adapters must raise client-safe
  messages — requirement recorded for the OQ-A/OQ-B handoff.
- 500s never leak exception text; the traceback is logged server-side only.

## ADR-010 — Env-driven settings with a localhost-only CORS allowlist

Date: 2026-09-09

### Context

The API is deployed on a Linux server and is called only server-to-server by
the application backend. Browsers should not be able to call it from arbitrary
origins, and no private or environment-specific value may live in source code.

### Decision

- Configuration is read from environment variables in `shared/config.py`
  (`load_settings()`): `APP_ENV`, `CORS_ORIGINS`, plus placeholder
  `AI_BASE_URL` / `AI_API_KEY` / `DATABASE_URL` for future sprints. Safe
  defaults ship in the tracked `.env.example`; the gitignored `.env` carries
  real values. `scripts/run.sh` loads `.env` via `uv --env-file`; docker
  compose passes `env_file: ../.env` to the api service.
- `CORSMiddleware` is configured from `settings.cors_origins` (default
  `http://localhost:4000`), `allow_credentials=False`, explicit methods
  (`GET`, `POST`, `PATCH`). Non-allowlisted origins receive no CORS grant.
- Stdlib `os.getenv` is used instead of adding a `pydantic-settings`
  dependency; there are too few variables to justify it.

### Consequences

- No secrets in code; only safe placeholders are committed.
- Adding a trusted origin is a `.env` change, no code change.
- Server-to-server calls need no CORS and are unaffected; CORS only gates
  browsers.

## ADR-011 — AI Case intake aligned to beautifiers-app ADR-017

Date: 2026-09-11

**Status:** Accepted

### Context

beautifiers-app froze the AI Case intake contract in accepted ADR-017
(+ ADR-021). AI Core's HTTP adapter was wire-incompatible: it posted to
`/ai-cases` (the real route is `POST /api/v1/ai/cases`), sent `correlation_id`
as a body field with no `Idempotency-Key` header, and ignored the response so
the canonical case id was lost. service-contracts tracked this as OQ-12/C15.

### Decision

Migrate the ai-core side to the ADR-017 transport rules:

- Endpoint defaults to `POST /api/v1/ai/cases`.
- `AiCaseIntakeRequest` body is `reference`, `subjectUserId` (camelCase alias),
  and `input` (`reference`, `origin`, `payload`); the v1.0.0
  `AiCasePersistencePayload` now travels as `input.payload`.
- One key, two headers: `Idempotency-Key` and `X-Correlation-Id` both derive
  from `payload.correlation_id`. The key never appears in the body. AI Core
  mints the key; the backend mints the canonical `id`.
- The adapter parses the 2xx response and returns
  `AiCaseCreationResult(ai_case_id, reference, status)`; the
  `ai_case_persist` node records `ai_case_id` in its audit payload.
- Non-2xx responses are mapped to client-safe messages that name the backend
  error `code` (401/403 auth-rejected, 409 conflict) without leaking raw
  backend text. Transient transport/5xx failures are retried within a bounded
  exponential-backoff policy; 4xx and response-shape failures fail immediately.
- Transport config is env-driven (`AI_CASE_BASE_URL`, `AI_CASE_PATH`,
  `AI_CASE_AUTH_TOKEN`, `AI_CASE_TIMEOUT_SECONDS`); `get_ai_case_adapter`
  returns the HTTP adapter when `AI_CASE_BASE_URL` is set, else the mock.
- Service authentication is a dedicated `X-AI-Core-Service-Token` header (not
  `Authorization: Bearer`), carried by `AI_CASE_AUTH_TOKEN`; the backend honours
  it only on the AI Case surface (Sprint 7 decision, owner Kabiri to implement).
- Timeout is 5.0 s per attempt; `max_attempts` (default 3) and exponential
  `backoff_seconds` (default 0.5) bound the retry (Sprint 7 decision, owner
  AI Core).

Old → new wire mapping: `POST /ai-cases` → `POST /api/v1/ai/cases`;
flat payload body → `{reference, subjectUserId, input:{reference,origin,payload}}`;
`correlation_id` body field → `Idempotency-Key` + `X-Correlation-Id` headers;
`Authorization: Bearer` → `X-AI-Core-Service-Token`;
`create_ai_case -> None` → `create_ai_case -> AiCaseCreationResult`.

### Consequences

- The five lineage versions remain embedded in the payload. Direction is
  agreed (Sprint 7): the backend `/lineage` endpoint takes five integers, AI
  Core writes the string→int mapping table, Kabiri confirms it; the integer
  values are still open (see `docs/sprints/sprint7/day3-lineage-contract.md`).
- Attachment mapping is decided (Sprint 7): the whole payload travels as
  `input.payload` (`INPUT`), and the specification is additionally posted as a
  `TREATMENT_SPECIFICATION` attachment via a second call (ADR-021 §1). The
  second call is deferred, not implemented — only the `input.payload` part is
  emitted today (owner Saeed + Kabiri).
- Service authentication model is agreed (Sprint 7): dedicated header resolving
  a seeded staff (`ADMIN`) principal; the backend implementation is pending
  (owner Kabiri).
- Duplicate-request behavior is contractual: new → `201`, replay → `200`, same
  `id`; same key / different payload → `409 IDEMPOTENCY_KEY_CONFLICT`.
- `AiCasePersistencePayload.correlation_id` stays: it is the logical-operation
  key from which both intake headers derive.
