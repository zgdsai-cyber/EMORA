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
component and to all four continuous state dimensions. The result also exposes
a separate fused prediction confidence, calculated from the deterministic
state's confidence dimension and the ML prediction's explicit confidence. All
fused values are clamped to their declared ranges and returned as immutable
domain objects.

- $\alpha = 1$: fully deterministic output.
- $\alpha = 0$: fully ML state output; confidence comes from the ML prediction.
- $0 < \alpha < 1$: weighted hybrid output.

The fused metadata records the ML model identifier/version and marks the state
as a hybrid result. No internal mutable references are exposed.

## Extension path

Future phases can implement an ML provider behind `MLEmotionalStateProvider`,
learn or calibrate parameter sets, and add temporal ML predictions. Those
implementations must preserve runtime range validation, deterministic fusion for
fixed inputs, immutable results, and the distinction between model confidence
and certainty about a person's actual internal experience.
