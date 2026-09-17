# Emotional Model

`@emora/emotional-core` is a pure TypeScript foundation for computing estimated
emotional states. It is a computational model, not a measurement of a person's
true internal emotional experience. It does not read minds, diagnose health
conditions, or claim scientific or clinical validity.

## Seven-dimension rationale (Phase 6.9 documentation supplement)

The current seven-dimensional registry is a frozen computational design choice,
not a claim that these dimensions form a universal psychological taxonomy. Each
dimension below separates a broad theoretical anchor from EMORA's engineering
operationalization; none is presented as an empirically validated law.

| Dimension | Theoretical anchor | EMORA operationalization | Limitation / non-claim |
| --- | --- | --- | --- |
| `love` | Attachment, bonding, and positive relational appraisal constructs. | A bounded emotion-vector component receiving configured positive and relational event influence, personality modulation, interaction, memory, and stability terms. | Not a clinical attachment measure or universal measurement of love. |
| `fear` | Threat appraisal, uncertainty, and negative affect constructs. | A bounded component receiving negative-valence and uncertainty-related influence under the interaction policy. | Not a diagnosis, threat detector, or universal fear scale. |
| `nostalgia` | Autobiographical memory and affective recollection constructs. | A bounded component influenced by relevance, surprise, memory influence, decay, and configured dynamics. | Not a validated measure of autobiographical nostalgia. |
| `jealousy` | Individual-difference and relational threat appraisal constructs. | A bounded component using configured uncertainty and negative-valence influences, personality modulation, memory, and interactions. | Not a validated interpersonal or clinical jealousy instrument. |
| `trust` | Relational expectation and social appraisal constructs. | A bounded component constrained by the interaction policy, including protected sign rules for fear/anger and trust coefficients. | Not a behavioral trust scale or universal social-cognition measure. |
| `anger` | Goal obstruction, negative appraisal, and action-readiness constructs. | A bounded component receiving negative-valence and relevance influence, personality modulation, interaction, memory, and stability terms. | Not a validated anger or aggression assessment. |
| `joy` | Positive affect and reward-related appraisal constructs. | A bounded component receiving positive-valence and surprise-related influence, personality modulation, interaction, memory, and stability terms. | Not a validated happiness or well-being measure. |

The registry also exposes `valence`, `arousal`, and `intensity` as continuous
affect dimensions, while `confidence` and `confidenceAdjustment` are
computational quantities rather than emotional dimensions. The table documents
the model's hypotheses and operationalizations only; synthetic or regression
agreement does not establish human psychological validity.

## Domain model

`EmotionVector` contains seven discrete, normalized dimensions: `love`, `fear`,
`nostalgia`, `jealousy`, `trust`, `anger`, and `joy`. Each value is in `0..1`.
Continuous dimensions are separate: `valence` is in `-1..1`, while `arousal`,
`intensity`, and model `confidence` are in `0..1`.

`EmotionalState` combines the vector, continuous dimensions, an explicit ISO
timestamp, and optional model version and metadata. `EmotionalEvent` is a
source-neutral input with signed valence and normalized intensity, relevance,
surprise, and uncertainty. Its source is a branded string so providers can
extend source conventions without coupling the core to a transport.

`PersonalityProfile` contains normalized, non-clinical model traits such as
emotional sensitivity, baseline trust, baseline anxiety, attachment sensitivity,
nostalgia sensitivity, and jealousy sensitivity. `EmotionalMemory` stores a
previous state with normalized intensity, importance, and decay rate. No decay
equation, embedding, or persistence is implemented in this phase.

`ModelVersion` identifies a model by `id`, `name`, and `version`. `ModelParameters`
supports named sets of finite numeric values and optional metadata.

## Validation and numerical safety

Runtime validation is part of the core. `normalize01` and
`validateNormalized01` validate a finite value in `0..1`; they do not silently
clamp or reinterpret input. `validateSignedNormalized` validates `-1..1`.
`clamp01`, `clampSignedNormalized`, and `clampEmotionVector` are explicit
clamping operations. `NaN`, positive infinity, negative infinity, and
out-of-range values throw `InvalidDomainValueError` or
`InvalidDomainObjectError`.

Domain factories return frozen objects at their public boundaries. All domain
fields are `readonly`; no function mutates its inputs. Arbitrary metadata is
shallow-copied and frozen by factories. Calculations receive timestamps rather
than reading the clock, and no random or global mutable state is used.

## Vector and confidence utilities

Vector helpers provide zero creation, validation, addition, weighted merging,
scaling, explicit clamping, Euclidean distance, and dominant-emotion lookup.
Dominant lookup returns the first dimension in the documented order on a tie and
returns `null` when every dimension is zero. Addition and scaling preserve the
normalized vector contract and therefore reject results outside `0..1`; callers
can use explicit clamping when that behavior is intended.

Confidence means confidence of the model estimate, never certainty about a
person's actual experience. Independent confidence values are multiplied, and
weighted confidence is the normalized weighted arithmetic mean. Empty inputs or
zero total weight are rejected.

## Temporal architecture

`StateTransitionInput` carries the current state, an event, a personality
profile, optional memories, and optional model parameters.
`StateTransitionProvider` exposes an identifier and optional model version, and
returns a `StateTransitionResult` containing the next estimated state,
optional explanation metadata, and an optional confidence adjustment.

This is an interchangeable contract only. Psychological equations,
deterministic psychological providers, machine-learning providers, hybrid
fusion, decay, and API orchestration are intentionally deferred.

## Determinism and boundaries

Given the same validated inputs, core functions return the same outputs. The
package imports no React, Next.js, database, authentication, browser, queue,
billing, or AI/ML dependencies. Persistence and transport layers must call the
public exports from `src/index.ts` and must not be added to this domain package.
