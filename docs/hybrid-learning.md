# Hybrid Learning Foundation

Phase 6.1 introduces contracts for combining the deterministic emotional
mathematical model with a future machine-learning model. The layer is kept
inside pure `@emora/emotional-core` and has no ML runtime, network client,
training loop, database, or framework dependency.

## ML provider boundary

`MLEmotionalStateProvider` receives the existing `StateTransitionInput`: current
state, structured event, personality profile, optional memories, and optional
model parameters. It returns an `MLEmotionalStatePrediction` containing an
estimated emotional state, model confidence, model identifier, optional model
version, and safe metadata.

This boundary allows a future implementation to use learned parameters or a
separate inference service without changing the deterministic provider or
coupling the domain package to Python, PyTorch, TensorFlow, or an AI SDK.
Phase 6.1 performs no training, inference, gradient calculation, or learned
parameter updates.

## Fusion

`fuseHybridPrediction` combines a deterministic `StateTransitionResult` and an
ML prediction with a validated coefficient $\alpha \in [0,1]$:

$$
hybrid = \alpha \times deterministic + (1 - \alpha) \times ML
$$

The same weighted equation is applied independently to every emotion-vector
component and to all four continuous state dimensions for intermediate values
of $\alpha$. The numeric endpoints are explicit: $\alpha=1$ selects every
numeric value from the deterministic state, while $\alpha=0$ selects every
numeric value from the ML state. This avoids relying on floating-point
interpolation for endpoint identity.

The result also exposes a separate fused prediction confidence, calculated from
the deterministic state's confidence dimension and the ML prediction's
explicit confidence. All fused values are clamped to their declared ranges and
returned as immutable domain objects.

- $\alpha = 1$: fully deterministic numeric state and deterministic prediction confidence.
- $\alpha = 0$: fully ML numeric state and ML prediction confidence.
- $0 < \alpha < 1$: weighted hybrid output.

Metadata has one explicit source-selection policy for both `state.metadata` and
the top-level prediction `metadata`. At $\alpha=1$, the state metadata and the
top-level metadata contain only deterministic state metadata. At $\alpha=0$,
the state metadata contains only ML state metadata and the top-level metadata
contains only ML prediction metadata. Neither endpoint includes metadata from
the non-selected source or hybrid provenance. For intermediate values, state
metadata is `{ deterministic: deterministic state metadata, ml: ML state
metadata, fusion: { alpha } }`, while top-level metadata uses the same wrapper
with ML prediction metadata in its `ml` field. This preserves each legitimate
source metadata at its owning API level without overwriting ambiguous keys.

The deterministic timestamp is the canonical timestamp for intermediate fusion.
At either endpoint, the selected source timestamp is returned exactly. At
intermediate values, the deterministic model version is preferred when present;
otherwise the ML model version is used. At either endpoint, the selected source
model version is returned exactly.

ML predictions and hybrid outputs use an internal deep-copy/deep-freeze utility
for primitives, `null`, `undefined`, arrays, and nested plain objects. Unsupported
values such as `Date`, `Map`, `Set`, class instances, and functions are rejected
with a runtime error rather than silently converted to `{}`. No internal mutable
references are exposed through the returned prediction boundary.

## Extension path

Future phases can implement an ML provider behind `MLEmotionalStateProvider`,
learn or calibrate parameter sets, and add temporal ML predictions. Those
implementations must preserve runtime range validation, deterministic fusion for
fixed inputs, immutable results, and the distinction between model confidence
and certainty about a person's actual internal experience.
