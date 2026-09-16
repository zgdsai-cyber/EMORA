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

Scientific: case id, reference type, dataset role (`DESIGN` / `HELD_OUT`) with
held-out parameter versions, per-case annotator counts and inter-rater values as
supplied, and annotation provenance (`DEFERRED` for human data).

## Deferred methodology

The following remain intentionally deferred and are not implemented: Pearson
methodology (unit and execution), Directional Accuracy methodology, Kendall
(removed from the roadmap), participant/scenario clustering and repeated-measure
methodology, human annotation aggregation, inter-rater coefficients, baseline
execution and comparator contracts, counterexample prioritization, automatic
scientific-support label assignment, statistical inference (confidence intervals,
hypothesis tests, multiplicity, non-inferiority), scientific thresholds,
ML/training, and dataset splitting for training.
