# API

Next.js Route Handlers are the REST API boundary. All endpoints are versioned
under `/api/v1`, run on the Node.js runtime (`force-dynamic`), and share one
frozen error envelope: `{ "error": { "code", "message", "requestId" } }` with a
fixed safe message per code — internal errors, SQL, stack traces, and payload
content are never returned.

## Authentication

Every endpoint requires a server-side Better Auth session (HTTP-only cookie).
Session identity is always derived server-side via `requireAuth`; no caller can
assert an identity or an organization through the request.

## Authorization

Authorization is server-derived via `requireProjectAccess(userId, projectId,
minimumRole)` against `organization_members` joined through the project's
`organization_id`. Roles are ordered `VIEWER < MEMBER < ADMIN < OWNER`.

- Write operations require `MEMBER` or above.
- Read operations require `VIEWER` or above.
- A browser-supplied organization identifier is never trusted.

## Endpoints

### POST /api/v1/projects/[projectId]/profiles/[profileId]/transitions

Runs one deterministic emotional transition for the profile and persists the
result atomically (event, state, and audit rows in a single transaction).

- **Authorization:** `MEMBER` minimum.
- **Headers:** `content-type: application/json`; a mandatory `Idempotency-Key`
  (8–128 printable ASCII characters). Replaying the same key with the same
  payload returns the original result (`duplicate: true`, HTTP 200) without a
  second write; the same key with a different payload returns 409.
- **Body:** `valence` (-1..1), `intensity`, `relevance`, `surprise`,
  `uncertainty` (each 0..1), optional bounded `context` object, optional
  `timestamp`. Unknown fields are rejected.
- **Success (201 / 200 replay):** `requestId`, `duplicate`, `projectId`,
  `profileId`, `eventId`, `stateId`, `timestamp`, `emotionVector` (love, fear,
  nostalgia, jealousy, trust, anger, joy), `dimensions` (valence, arousal,
  intensity), `modelIdentity` (modelVersionId, name, version,
  providerIdentifier, providerVersion), `parameterIdentity`, `initialized`,
  `disclosure`, `disclosureText`.
- **Errors:** `invalid_input` (400), `invalid_content_type` (400),
  `idempotency_key_required` (400), `unauthenticated` (401), `forbidden` (403),
  `profile_not_found` (404), `idempotency_conflict` (409), `temporal_conflict`
  (409), `concurrency_conflict` (409), `profile_data_invalid` (500),
  `internal_error` (500).

### GET /api/v1/projects/[projectId]/profiles/[profileId]/states/latest

Returns the most recently persisted computational state for the profile. This
is a read: it never writes product state and never mutates history.

- **Authorization:** `VIEWER` minimum. Lookup is constrained to the
  `(projectId, profileId)` pair, so a profile from another project is never
  returned (indistinguishable from "no state yet").
- **Success (200):** `requestId`, `projectId`, `profileId`, `stateId`,
  `timestamp`, `emotionVector` (love, fear, nostalgia, jealousy, trust, anger,
  joy), `dimensions` (valence, arousal, intensity), `modelIdentity`
  (modelVersionId, name, version, providerIdentifier, providerVersion),
  `parameterIdentity`, `initialized`, `disclosure`, `disclosureText`.
- **Errors:** `invalid_input` (400), `unauthenticated` (401), `forbidden` (403),
  `state_not_found` (404), `state_data_invalid` (500, persisted state failed
  domain validation), `internal_error` (500).
- **Audit:** every successful 200 read writes exactly one `audit_logs` row with
  action `emotional_state.read` whose metadata is limited to operational
  identifiers (`projectId`, `profileId`, `stateId`, `requestId`, `outcome`).
  If that audit row cannot be written, the read fails closed with
  `internal_error` (500) instead of returning an unaudited 200 — see
  `docs/decisions/read-audit-semantics.md`. No emotion values, dimensions,
  confidence, raw JSONB, context, memories, embeddings, payloads, or secrets are
  recorded. Failed requests (401, 403, 404, 500) create no audit rows and use
  structured operational logging only.

## Response fields that are never exposed

Neither endpoint returns `confidence`, `confidenceAdjustment`, raw persisted
JSONB or its `metadata`, raw `context`, memories, embeddings, internal
diagnostic payloads, or any field named or functioning as a dominant emotion,
ranking, winner, threshold, composite score, or superiority/comparison measure.

## Scientific disclosure

Both endpoints return `disclosure` (code) and `disclosureText` from the single
frozen constant `SCIENTIFIC_DISCLOSURE_TEXT`, which is byte-identical in the
API and the UI. The wording is:

> EMORA output is a computational, model-estimated emotional state derived from
> the event and context you supplied, using EMORA's deterministic model. It is
> not a measurement of a person's true emotional state. It is not a detection
> of a person's true emotional state. It is not a diagnosis. It is not a
> clinical assessment. It does not establish psychological validity, and it
> must not be used as evidence of what a person actually feels.

## Prohibited interpretation

EMORA's API outputs must not be described or used as measurement, detection,
diagnosis, clinical assessment, or evidence of what a person actually feels,
and must not support psychological-validity claims. Synthetic engineering
results are not evidence of human psychological validity. Synthetic evaluation
and human behavioral evaluation remain separate.

## Out of scope (deliberately not implemented)

- History listing, pagination, cursors, aggregation, comparison, or
  multi-profile sorting.
- Ranking, dominant emotion, thresholds, composite scores, or any
  superiority/comparison metric.
- ML runtime, hybrid fusion, learned parameters, memory retrieval, RAG,
  embeddings, or vector search.
- API-key issuance or programmatic third-party access (the `api_keys` table is
  schema foundation only).
- Parameter-version HTTP surface, profile/project/organization CRUD, webhooks,
  rate limiting, and evaluation-runtime coupling.

See `docs/security.md` for the authorization model, `docs/privacy.md` for data
handling boundaries, and `docs/evaluation.md` for the evaluation boundary.
