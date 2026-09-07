# Emotional Core

Pure, deterministic TypeScript contracts and mathematical utilities for
estimated emotional states. The package has no framework, persistence, network,
authentication, browser, or machine-learning dependencies.

Invalid numeric input throws a domain error. Validation never silently clamps;
use the explicit clamp helpers when clamping is desired. See
`docs/emotional-model.md` for the domain and temporal architecture.
