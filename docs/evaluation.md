# Evaluation

This document describes the evaluation architecture in `packages/emora-evaluation`
and the boundaries every evaluation result must respect.

## Scientific position

EMORA is an interpretable computational framework for modeling dynamic emotional
states. Its architecture is informed by established research in appraisal theory,
dimensional affect, individual differences in affective responsiveness, emotional
memory, and emotion dynamics.

EMORA does not currently claim to constitute a scientifically validated model of
human emotion. Specific mathematical formulations, interaction parameters,
temporal functions, and parameter values are treated as model hypotheses or
engineering operationalizations unless independently supported by empirical
evidence.

No automated report produces a model-wide scientific verdict, a composite score,
or a claim of psychological validity.

## Evaluation levels

| Level | Meaning | Status |
| --- | --- | --- |
| L1 | Structural / mathematical evidence intrinsic to the implementation: bounds, structural invariants, determinism, explicitly contracted local monotonicity, stability behavior, memory-strength behavior, computational confidence validity (gates G1–G7). | Implemented |
| L2 | Case/scenario-based behavioral evaluation against explicit reference annotations (MAE/RMSE per dimension, Spearman per ranking case). | Implemented |
| L3 | Empirical human-data evidence. Requires HUMAN_ANNOTATED references, a HELD_OUT dataset, a declared study design, and predefined statistical and interpretation methodology. | Deferred — prerequisites not yet defined |
| L4 | Generalization / external validation. | Not implemented |

Successful L1 or L2 evaluation does not establish psychological validity. The
presence of HUMAN_ANNOTATED data does not by itself make an evaluation L3.

### Descriptive evidence level

Every report carries a descriptive `evidenceLevel` derived only from
`referenceType` and `datasetRole`:

| Metadata | `evidenceLevel` |
| --- | --- |
| L1 gate report | `L1_STRUCTURAL` |
| `SYNTHETIC_ORACLE` | `L2_SYNTHETIC` |
| `EXPERT_DESIGN`, `BASELINE_AGREEMENT` | `L2_REFERENCE` |
| `HUMAN_ANNOTATED` on a non-HELD_OUT dataset | `L2_HUMAN_NOT_HELD_OUT` |
| `HUMAN_ANNOTATED` on a HELD_OUT dataset | unclassified (`undefined`) |

The field never reads metric values or execution results, is never `L3`, and is
not a `ScientificSupportLabel`, a quality score, or an inference.

## Synthetic evaluation boundary

Synthetic references (`SYNTHETIC_ORACLE`) may support mathematical testing,
structural testing, regression testing, deterministic testing, and
implementation validation.

Synthetic evaluation must not be treated as evidence of psychological validity in
humans. Expert-designed and baseline-agreement references are theory-guided or
relative-agreement evidence, not human ground truth.

## Human behavioral evaluation

Human behavioral evaluation is a separate future methodology. `HUMAN_ANNOTATED`
references are empirical reference data subject to subjectivity, annotator
disagreement, sampling, context, and protocol effects; they are not automatically
absolute ground truth and do not automatically establish scientific validity.
Annotation aggregation methods and inter-rater interpretation are deferred;
supplied annotator counts and agreement values are preserved per case without
being combined.

## Methodological Decision Specification (MDS v1.0)

Evaluation methodology is governed by the owner-approved MDS v1.0. The
authoritative MDS document is maintained externally; the repository encodes its
decisions in `contracts.ts`, `dimensions/registry.ts`, `metrics/definitions.ts`,
and their tests. Key encoded decisions:

- Dimension registry: seven EMOTION dimensions in `[0, 1]`; `valence` `[-1, 1]`,
  `arousal`, `intensity` as CONTINUOUS_AFFECT; `confidence` and
  `confidenceAdjustment` as COMPUTATIONAL (excluded from behavioral metrics).
  Unknown reference dimensions are technical contract violations, never silently
  ignored.
- MAE/RMSE: unit `(case, dimension)`, per-dimension across cases, scale
  `ERROR_NON_NEGATIVE` (error range follows the dimension range, e.g. up to 2 for
  valence). No scientific thresholds exist.
- Coverage: `MetricCoverage` (planned / eligible / contributing / excluded with
  reasons) is authoritative. `MetricResult.missingCasesCount` is a legacy,
  non-authoritative field that is always `0` and never overrides coverage.
- Dataset identity: `datasetHash = hashCanonical({ datasetId, datasetVersion,
  referenceType, cases })`, verified by the runner and the aggregator; a mismatch
  is fatal. `casesCount` must equal `cases.length`. On a HELD_OUT dataset that
  declares `heldOutParameterVersionIds`, an evaluated `parameterVersionId` must be
  in that list.

### A1 Spearman protocol

- Ranking space: EMOTION only; mixing semantic classes is a
  `MIXED_SEMANTIC_SPACE` violation.
- Reference encoding: competition ranks, integers in `[1, n]`, ties allowed,
  subsequent positions skipped after a tie (`[1,1,3]` valid; `[1,1,2]` invalid).
  Invalid encodings are `REFERENCE_INVALID` and excluded observably.
- Direction: `RANK_1_IS_HIGHEST`.
- Reference ties are transformed to average ranks (`[1,1,3] → [1.5,1.5,3]`);
  model scores are transformed to fractional ranks with rank 1 for the highest
  score. Each side is transformed exactly once; the original reference annotation
  is preserved.
- Technical minimum `n >= 2`; this is not a scientific threshold.

## Provenance

Technical: dataset id/version/hash, parameter version id/hash, engine version and
commit, evaluation contract version and `evaluationContractHash` (deterministic
hash of the frozen metric definitions, ranking protocol, and dimension registry),
runtime contract, configuration hash, and caller-supplied `toolchainIdentity`.

Synthetic dataset generator provenance is optional and caller-supplied: generator
id/version, generator commit, generator configuration hash, and a seed only when
the generator actually uses randomness. Generator provenance is usage metadata;
it is excluded from the current dataset content hash, which remains exactly
`hashCanonical({ datasetId, datasetVersion, referenceType, cases })`.

Scientific: case id, reference type, dataset role (`DESIGN` / `HELD_OUT`) with
held-out parameter versions, per-case annotator counts and inter-rater values as
supplied, and annotation provenance (`DEFERRED` for human data).

## Phase 6.11 descriptive Pearson correlation

Pearson correlation is an executable descriptive metric over paired, finite
`EXACT_VECTOR` observations with unit `(case, dimension)`, aggregated at run
level for one fixed behavioral dimension. It applies to EMOTION and
CONTINUOUS_AFFECT dimensions only; computational dimensions remain excluded.
The technical minimum is $n \geq 2$, not a scientific sufficiency threshold.
Missing, invalid, and absent observations are excluded through `MetricCoverage`
without imputation or implicit reordering.

Pearson is mathematically `UNDEFINED` when either paired series has zero
variance. This is distinct from `INVALID` input and `INSUFFICIENT_DATA`, is
never coerced to a numeric correlation, and remains descriptive rather than an
inferential or psychological-validity claim. Runs governed by this activation
use caller-supplied contract version `mds-v1.0-pearson-v1` and the corresponding
canonical `evaluationContractHash`; prior run identities remain unchanged.

Directional Accuracy remains methodology-undefined and is not executed. Current
contracts do not define temporal state pairing, sequence/transition identity, or
reference-delta provenance, so no direction semantics or temporal contracts are
introduced here.

## Deferred methodology

The following remain intentionally deferred and are not implemented: Directional
Accuracy methodology, Kendall
(removed from the roadmap), participant/scenario clustering and repeated-measure
methodology, human annotation aggregation, inter-rater coefficients, baseline
counterexample prioritization, automatic scientific-support label assignment,
statistical inference (confidence intervals,
hypothesis tests, multiplicity, non-inferiority), scientific thresholds,
ML/training, and dataset splitting for training.

## Phase 6.9 comparator boundary

Phase 6.9 permits only deterministic, descriptive comparator contracts. A
constant baseline must declare one bounded value for each supported behavioral
dimension and must not fit values from evaluation data. A deterministic ablation
must be represented by an immutable, caller-governed parameter configuration;
this evaluation package deliberately provides no parameter conversion, hash
verification, activation, mutation, or execution decorator for that configuration.
Those operations remain exclusively with the already-governed caller. Runtime
mutable ablation switches are not permitted. The semantics of a generic
`NAIVE` baseline, persistence, previous-version comparison, and random baselines
remain deferred.

Candidate and baseline results must be paired only when the dataset id, version,
canonical content hash, reference type, ordered case identities, and evaluation
contract hash match. Candidate and baseline parameter/engine identities remain
separate provenance; comparison does not calculate a winner, superiority,
relative improvement, scientific score, or scientific support label.

The minimal synthetic comparator fixture is an `EXPERT_DESIGN` software
verification artifact. It is independently authored, not reverse-engineered
from EMORA outputs, and is not human evidence, psychological validation, or a
benchmark corpus. The seven-dimension rationale in `docs/emotional-model.md`
documents theoretical anchors, EMORA operationalizations, and non-claims while
leaving the frozen registry and equations unchanged.

## Phase 6.10 synthetic reference corpus v1

The Phase 6.10 corpus is a small, repository-contained `EXPERT_DESIGN` /
`DESIGN` artifact for controlled model-behavior verification, regression testing,
and evaluation-pipeline validation. It is hand-authored, deterministic, and
reproducible; it is not human psychological ground truth, empirical or clinical
validation, population evidence, or evidence that EMORA correctly models human
emotion.

The v1 fixture contains seven deliberately scoped `EXACT_VECTOR` cases:
neutral low-impact, positive event, negative event, low surprise, high surprise,
standard personality, and high-sensitivity personality. Each case carries a
short purpose and explicit excluded dimensions in annotation metadata. Partial
targets are intentional: values are finite, bounded engineering expectations,
not objectively correct human responses. Computational dimensions are excluded
from reference targets. No `RANKING`, interval, distribution, or directional
execution methodology is added in this phase.

Reference targets are authored independently of EMORA outputs. They must not be
generated, copied, transformed, tuned, or optimized from EMORA runs or metrics.
Structural tests can verify the fixture's shape and identity, but cannot prove
the historical authorship process. The fixture uses no generator metadata or
seed because it is hand-authored rather than produced by a generator.

The corpus preserves MDS v1.0 unchanged, including the content identity
`hashCanonical({ datasetId, datasetVersion, referenceType, cases })`; title,
description, provenance metadata, and runtime information remain outside that
identity. It is consumable by the existing Phase 6.9 candidate/baseline
comparator without adding baselines, scores, winners, labels, metrics, or
scientific claims. Human behavioral evaluation remains a separate future
methodology.

## Phase 6.13 candidate mathematical comparison artifact

`src/candidate-comparison/` provides a read-only analytical data model and
validation layer for recording candidate mathematical formulations per EMORA
component. Its purpose is to preserve comparison results in a traceable,
deterministic form. It does not evaluate, execute, select, or implement any
candidate, and the current EMORA model remains the active model.

- **Scope.** Every artifact is component-local (`EVENT_IMPACT`,
  `PERSONALITY_MODIFIER`, `VALENCE`, `AROUSAL`, `INTENSITY`, `MEMORY`,
  `TEMPORAL_DYNAMICS`, `INTERACTION_MATRIX`, `HYBRID_FUSION`) and carries
  `scope: 'READ_ONLY_ANALYTICAL'`. No cross-component aggregate, global model
  score, or project-wide "best formulation" exists. Candidate order is preserved
  as supplied and carries no meaning.
- **Provenance.** Each candidate records a `sourceStatus` (`VERIFIED`,
  `UNVERIFIED`, `NOT_LOCATED`, `NOT_APPLICABLE`, `NOT_REPORTED`), the reported
  descriptive/causal interpretation, and optional title, authors, year,
  publication, identifier, equation reference, page, and section.
- **Source verification.** `VERIFIED` requires `verificationBasis:
'CALLER_DECLARED_ORIGINAL_SOURCE_INSPECTION'`, `verifiedBy`, title, authors,
  year, publication, equation reference, and page or section. The status is a
  caller declaration that the original source was inspected; the validator
  checks metadata completeness only and never verifies a source itself.
  Citation by another paper, AI suggestion, or resemblance to EMORA does not
  qualify. Equations may be recorded under `UNVERIFIED`, `NOT_LOCATED`,
  `NOT_REPORTED`, or `NOT_APPLICABLE`; storing an equation proves nothing.
- **Compatibility axes.** `construct`, `input`, `output`, `scale`, `temporal`,
  `parameter`, `computational`, `interpretability`, each valued only as
  `COMPATIBLE`, `PARTIALLY_COMPATIBLE`, `INCOMPATIBLE`, or `UNKNOWN`. Numeric
  values and aggregate/overall compatibility fields are rejected. Mixed
  compatibility across axes is intentional and preserved.
- **Evidence taxonomy.** `MATHEMATICAL`, `THEORETICAL`, `EMPIRICAL`,
  `ENGINEERING` are descriptive labels; no evidence, scientific, or confidence
  score field is permitted.
- **Construct separation.** `INTENSITY` candidates must declare
  `EVENT_INTENSITY` or `EMOTIONAL_STATE_INTENSITY`; `MEMORY` candidates must
  declare `DECLARATIVE_MEMORY`, `EMOTIONAL_MEMORY`, or
  `EMOTIONAL_PERSISTENCE_INERTIA`; `INTERACTION_MATRIX` candidates must declare
  `ASSOCIATION`, `COUPLING`, `DEPENDENCY`, or `CAUSALITY`. `CAUSALITY` is only
  accepted as reported by a `VERIFIED` source with `CAUSAL` interpretation; a
  computational coupling is never upgraded to a causal claim.
- **Synthetic/human separation.** Synthetic requirements carry
  `evidenceClass: 'SYNTHETIC_MATHEMATICAL'` with engineering/mathematical kinds
  (boundedness, determinism, monotonicity, edge cases, numerical stability,
  regression, runtime compatibility, parameter sensitivity). Human requirements
  carry `evidenceClass: 'HUMAN_BEHAVIORAL'` with methodology kinds (target
  construct, measurement, participant structure, repeated observations, time
  scale, annotation, missingness, inter-rater variability, predefined criteria,
  baseline, held-out). Kinds and classes are disjoint and cross-labelling is
  rejected. Synthetic metadata is never psychological-validity evidence; no
  human data is collected and no inference is defined.
- **No ranking.** No `rank`, `ranking`, `winner`, `score`, `superiority`,
  `selected`, or `recommendation` field is accepted at any level, and the
  module exports no selection, ranking, scoring, or optimisation function.
- **No automatic scientific selection.** Candidate assessment ("how compatible
  is this candidate with the current EMORA role?") is never transformed into
  `ADOPT`/`ADAPT`/`RETAIN`/`REJECT`/`DEFER`. A candidate-level `decision` field
  is rejected.
- **Relationship to the Mathematical Decision Register.** Each artifact carries
  a caller-supplied `governedDecisionReference` (`registerVersion`,
  `decisionId`, `currentDecision`). Only register `1.0.0` is known; any other
  version fails closed, and the reference must match the frozen Phase 6.12
  state (`MDR-001`…`MDR-008` `RETAIN`, `MDR-009` `DEFER`). The in-code mirror
  `MATHEMATICAL_DECISION_REGISTER_1_0_0` is not a second source of truth: a test
  parses `docs/mathematical-decision-register.md` and fails on divergence. The
  register itself is unchanged by this phase.

Artifacts accept only inert plain-data graphs (no accessors, custom prototypes,
symbol properties, sparse arrays, or custom array fields), are deep-frozen, and
carry `artifactHash = hashCanonical(content)`; identical inputs yield identical
artifacts.
