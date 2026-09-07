# Emotional Model

`@emora/emotional-core` is a pure TypeScript foundation for computing estimated
emotional states. It is a computational model, not a measurement of a person's
true internal emotional experience. It does not read minds, diagnose health
conditions, or claim scientific or clinical validity.

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
