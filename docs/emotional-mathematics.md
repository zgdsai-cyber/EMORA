# Emotional Mathematical Engine

Phase 5 adds the first deterministic transition model to the pure
`@emora/emotional-core` package. It produces **model estimates** of an
emotional state. It does not detect true human emotions, read minds, diagnose
conditions, make clinical predictions, or claim scientific validation.

## Pipeline

`DeterministicEmotionalDynamicsProvider` validates its input and applies this
fixed pipeline:

1. Extract structured event features.
2. Calculate event impact.
3. Calculate personality modifiers.
4. Calculate base emotion influence.
5. Apply one-pass emotion interactions.
6. Calculate direct memory influence.
7. Combine influences and apply temporal stability.
8. Calculate continuous dimensions and model confidence.
9. Return an immutable state and serializable explanation metadata.

The provider has no random source, clock access, global mutable state, I/O, or
persistence. Equal validated inputs produce equal outputs.

## Event features and impact

`extractEventFeatures(event)` copies the event's structured values:
`valence`, `intensity`, `relevance`, `surprise`, and `uncertainty`. No text or
NLP inference is performed.

The default impact formula is:

$$
I = intensity \times relevance \times (0.5 + 0.5 \times surprise)
$$

The two surprise coefficients are explicit in `eventImpactWeights` and can be
replaced by a caller. With normalized inputs and the default coefficients,
$I \in [0,1]$.

## Personality modulation

For every supported personality trait, the default modifier is:

$$
M(trait) = 1 + w \times (trait - 0.5)
$$

`w` is an explicit parameter. The modifier is bounded below by zero. The
provider maps emotional sensitivity to fear, anger, joy, and trust; attachment,
nostalgia, jealousy, anxiety, and baseline trust use their corresponding
traits. This mapping is a **computational hypothesis**, not a validated
psychological claim.

## Base influence

Let $p = max(valence, 0)$ and $n = max(-valence, 0)$. Each emotion receives a
non-negative magnitude made from explicit coefficients:

- love: $I(p \cdot w_p + relevance \cdot w_r)$
- fear: $I(n \cdot w_n + uncertainty \cdot w_u)$
- nostalgia: $I(relevance \cdot w_r + surprise \cdot w_s)$
- jealousy: $I(uncertainty \cdot w_u + n \cdot w_n)$
- trust: $I(p \cdot w_p)$
- anger: $I(n \cdot w_n + relevance \cdot w_r)$
- joy: $I(p \cdot w_p + surprise \cdot w_s)$

The result is explicitly clamped into an `EmotionVector`. These are
computational hypotheses only. They do not assert that the named emotions
follow these relationships in real people.

## Interaction matrix

`interactionWeights[source][target]` is a configurable one-pass coefficient.
The interaction contribution is:

$$
interaction[target] = \sum_{source} influence[source]
  \times interactionWeights[source][target]
$$

Default examples are fear and anger decreasing trust, fear increasing anger,
joy increasing love, and love increasing trust. Coefficients are bounded in
`[-1,1]`; interactions are not recursively fed back into the matrix, so there
are no infinite loops.

## Memory influence

For a memory at or before the event timestamp:

$$
S = intensity \times importance
  \times e^{-decayRate \times elapsedSeconds}
$$

A future memory is ignored and contributes zero. An invalid reference
 timestamp is rejected. Memory influence compares the memory vector with the
current vector and applies the configured per-emotion memory weight:

$$
memoryInfluence[e] = (memory[e] - current[e])
  \times S \times memoryWeight[e]
$$

No embeddings, semantic search, or persistence are used. Zero decay preserves
strength; high decay reduces old memory influence toward zero.

## Temporal stability

The stability step is a computational return-to-baseline mechanism, not a model
of human recovery:

$$
next[e] = clamp01(current[e] + delta[e]
  + rate \times (baseline[e] - current[e]))
$$

The rate and baseline vector are explicit in `stabilityWeights`. A rate of zero
disables this pull; a rate of one moves directly to the baseline after the
current delta is applied and clamped.

## Continuous dimensions and confidence

The next valence is the positive vector average minus the negative vector
average, with a small explicit event-valence contribution. Arousal is the
average of fear, anger, joy, and jealousy. Intensity is the mean of all seven
emotion values. All are validated against their declared ranges.

Model confidence is:

$$
confidence = clamp01(base
  \times (1 - uncertainty \times uncertaintyPenalty)
  \times memoryFactor)
$$

`memoryFactor` uses separate configured values for transitions with and without
provided memories. This is confidence in the computational estimate, never
certainty about a person's internal experience.

## Parameters and safety

`createDefaultModelParameters()` returns a small, readable deterministic set
covering event impact, personality, emotion, interactions, memory, stability,
and confidence. `validateModelParameters()` rejects `NaN`, infinities,
non-finite sets, out-of-range rates, invalid baselines, and invalid interaction
coefficients. Domain validation also rejects invalid timestamps and vectors.

All returned states and explanation objects are immutable. The explanation
contains event impact, personality modifiers, base influence, interaction
influence, memory influence, stability influence, and confidence factors. It
contains no secrets or mutable internal references.

## Limitations and next phase

This engine is an experimental deterministic mathematical foundation. It has no
learned parameters, calibration data, psychological equations, ML provider,
hybrid fusion, API, database, or real-world validation. Phase 6 may add another
provider only after its assumptions, ranges, tests, and limitations are defined.
