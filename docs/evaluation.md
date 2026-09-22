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

## Phase 6.14 synthetic mathematical re-evaluation

`src/synthetic-reevaluation/` provides component-local infrastructure for
deterministic synthetic examination of documented mathematical formulations. A
formulation is executable only when its equation, variables and domains, construct,
input domain, output scale and units, parameters, and temporal assumptions are all
explicit. Missing specification produces `NOT_EVALUABLE` without invoking the
caller-governed executor.

Plans contain predefined absolute and relative numeric tolerances, deterministic
cases, declarative property assertions, and complete executor/configuration
provenance. Every run is executed twice. Artifacts preserve both numeric outputs,
use only `SATISFIED`, `VIOLATED`, `NOT_APPLICABLE`, or `NOT_EVALUABLE` per property,
record reproducible counterexamples for violations, are deep-frozen, and carry a
canonical SHA-256 content hash. Results remain local to one formulation of one
component; no aggregate status, metric, score, ranking, winner, recommendation, or
scientific-support label is produced.

Synthetic results are mathematical and engineering observations only. They use no
human data, inferential statistics, calibration, optimization, parameter fitting,
ML, or causal inference, and they do not establish human behavioral or
psychological validity. Candidate source status does not imply mathematical or
scientific superiority. Construct, scale, units, parameter assumptions, and
temporal assumptions are preserved verbatim in each artifact.

Current formulations must reference the matching frozen decision-register entry.
An executable candidate must additionally reference a valid, hash-matching Phase
6.13 component artifact and an existing candidate id/family within it; its equation
and variable metadata must match that record. This establishes traceable candidate
authority without making the candidate approved, selected, or scientifically
supported. Missing authority or specification yields `NOT_EVALUABLE` without
execution; forged or inconsistent references are rejected.

`HYBRID_FUSION` is excluded from execution in Phase 6.14. Its dedicated artifact
records `DEFERRED` and contains no cases or results; MDR-009 remains unchanged.

## Phase 6.15 human behavioral evaluation methodology protocol

`src/human-methodology/` defines a versioned, validated, canonically hashed
methodology artifact for a possible future human behavioral evaluation. Phase
6.15 is protocol-only: it collects and processes no human data, executes no human
evaluation, computes no metric or inference, and selects no questionnaire,
instrument, baseline, model, parameter, or winner.

The protocol records its identity and status; target, excluded, computational-only,
and deferred outputs/components; the conceptual observation schema; construct
mappings; governed population and partition definitions; descriptive criteria;
baseline requirements; repeated-observation and individual-difference
requirements; leakage controls; falsifiability conditions;
reproducibility provenance; ethics/governance requirements; scientific boundaries;
and every unresolved or non-evaluable methodological item. `DEFINED`,
`UNRESOLVED`, and `NOT_EVALUABLE` are governed states. A protocol cannot be marked
`DEFINED` while required configuration remains unresolved or non-evaluable.
Every unresolved population, mapping, criterion, baseline, temporal,
individual-difference, or partition state requires a matching unresolved-item
record; a defined descriptive criterion cannot depend on an unresolved mapping.

The canonical Phase 6.15 artifact remains `UNRESOLVED`. No psychological
equivalence is asserted: emotional and continuous-affect outputs have unresolved
indirect-indicator mappings, while state `intensity` is `NOT_EVALUABLE` pending an
approved human construct and measurement mapping. `confidence` and
`confidenceAdjustment` are explicitly computational-only, and `HYBRID_FUSION`
remains deferred. The module exports artifact creation/validation only and no
evaluation runner.

Phase 6.14 remains the separate deterministic **Synthetic Mathematical
Evaluation** track. Its results are not evidence of human psychological validity.
Phase 6.16, if separately authorized after the unresolved protocol requirements
are governed, would be the distinct **Human Behavioral Evaluation** track. Human
observations would be measurements or indicators rather than direct access to
internal emotional states; they cannot establish causality, scientific validity,
clinical interpretation, or automatically modify governed mathematical decisions.

The protocol makes no legal or regulatory compliance claim. Any future collection
requires study-specific informed-participation/consent handling where applicable,
pseudonymization, minimization, access control, secure handling, retention/deletion
and withdrawal procedures, and an explicit prohibition on clinical or diagnostic
use.

## Phase 6.16 D09 descriptive evaluation criteria

`src/d09/` implements only D09: descriptive correspondence/association between
EMORA computational outputs and predefined human-observable indicators. Its
active outputs are Pearson correlation, paired descriptive distributions, and
explicit coverage/missingness accounting. MAE, RMSE, Spearman, directional
accuracy, inferential statistics, composite scores, rankings, thresholds,
baselines, model selection, and automatic model changes remain inactive.

The canonical D09 artifact contains no criteria or human observations and returns
`NOT_EXECUTABLE_NO_HUMAN_DATA`; it does not authorize collection. It is the only
contract identity accepted by the execution boundary. Hash integrity does not
confer methodological authority: caller-created criteria, mappings, instruments,
or scale interpretations remain non-authoritative even when canonically hashed.

Phase 6.15 remains `UNRESOLVED`, with `execution: NOT_IMPLEMENTED` and
`humanData: NONE`. Consequently, D09 publishes no executable dimension and cannot
create a governed human dataset or produce an `EXECUTED` report. Criteria-bearing
proposals are explicitly `NOT_EXECUTABLE_PHASE_6_15_UNRESOLVED`. The seven
emotions plus `valence` and `arousal` remain independently representable as
future proposals; `intensity` remains `NOT_EVALUABLE`, and `confidence` plus
`confidenceAdjustment` remain computational-only. Changing this state requires a
future governed Phase 6.15 decision and a new authoritative D09 identity.

The six human states `OBSERVED`, `MISSING`, `INVALID`, `NOT_APPLICABLE`,
`DECLINED`, and `WITHDRAWN` remain distinct. There is no imputation,
interpolation, resampling, result-dependent transformation, or silent omission.
Because Phase 6.15 has not defined an executable eligibility denominator, D09
reports `NOT_EVALUABLE_PHASE_6_15_UNRESOLVED` rather than fabricating planned,
eligible, observed, or contributing counts. Exclusions are explicitly
`NONE_CONFIGURED`, partial-response handling is `NOT_CONFIGURED`, and unsupported
rules are rejected rather than ignored. Participant aggregation and repeated-
measures methodology remain deferred; multi-participant, multi-study,
multi-session, multi-sequence, or incompatible-context pooling is rejected.

Synthetic unit tests use `D09_UNIT_TEST_FIXTURE`, never the governed-human-data
discriminant. Production evaluation rejects those fixtures as non-human and
produces no human result. No human dataset is embedded or persisted by D09.

The frozen metric identity points to the existing Phase 6.11 Pearson
implementation; D09 contains no duplicate Pearson formula. If a future governed
execution is authorized, its technical minimum $n \geq 2$, finite-pair rule, and
zero-variance `UNDEFINED` behavior remain applicable. Current reports expose the
formula identity, metric interpretation, missingness vocabulary, exclusion and
partial-response states, denominator non-evaluability, deferred aggregation and
temporal methodology, and explicit scientific boundaries. They contain no human
statistics. D09 establishes neither construct equivalence, causality,
psychological or clinical validity, population generalization, nor support for
changing EMORA mathematics. D11–D16 remain outside this implementation.

## Phase 6.16 D10 threshold methodology

`src/d10/` implements the resolved D10 methodology as a versioned, validated,
canonically hashed plain-data contract. A threshold is a predefined, scope-bound
comparison or interpretation rule applied to a specified descriptive metric under
explicitly documented methodological, measurement, contextual, temporal,
denominator, and provenance conditions. It cannot establish psychological or
scientific validity, emotional truth, emotion detection, causality, prediction,
calibration, superiority, or scientific success.

Thresholds are optional. The canonical D10 artifact has
`NO_THRESHOLD_DEFINED`, `numericalThresholds: NONE_DEFINED`, and creates no
default Pearson threshold. Universal Pearson cutoffs and generic
weak/moderate/strong conventions are not represented. A future rule can only be
represented as an immutable, explicitly unauthorized proposal carrying a declared
rule identity and declared content hash. D10 defines no structured rule-value or
cutoff field and executes no referenced rule content; it defines no sample-size
threshold, minimum-$N$ logic, or numerical derivation algorithm. Caller-supplied
references remain opaque declarations, not executable methodology. A hash
establishes local content integrity only. It does not establish methodology
authority, rule correctness, result independence, or temporal priority.

Any future rule must be result-independent and frozen before inspection of the
results it interprets. Its derivation procedure must also be frozen in advance,
and any derivation-data identity must be independent of those interpreted
results. The artifact validates explicit declarations of those requirements but
records `NOT_VERIFIED_NO_EXTERNAL_TIMELINE_AUTHORITY`: a caller-supplied timestamp
does not prove that freezing preceded result inspection. `RESULT_DERIVED_PROHIBITED`
is a validation violation, not an existence, applicability, or provenance state.
Existence, applicability, provenance, authority, and governance violations remain
separate concepts.

Every represented rule is scoped to exactly one existing D09 metric and one
individually named EMORA dimension. Its scope also records the construct, paired
human indicator, instrument and version, language, scale and direction,
population, context, temporal relationship, transformation, denominator and
missingness rule, and exclusions. Provenance records justification, optional
independent derivation-data identity, methodology/configuration versions, EMORA
parameter/equation versions, and freeze identity. Application requires an exact
scope hash match; there is no automatic transfer across dimensions, constructs,
instruments or versions, languages, populations, contexts, scales,
transformations, or temporal relationships. A changed scope requires a newly
defined and frozen artifact. D10 implements no measurement-invariance protocol.

Applicability is fail-closed. The current implementation owns no authorized
threshold definition, so even a structurally valid, self-hashed proposal with a
`COMPUTED` metric and exact scope match remains
`NOT_APPLICABLE_UNAUTHORIZED_THRESHOLD`. No threshold comparison or descriptive
interpretation is produced. Authorizing a concrete rule requires a separately
governed future implementation identity; caller declarations and hashes cannot do
so. `UNDEFINED`, `INVALID`, and `INSUFFICIENT_DATA` metrics remain not evaluable
and receive no threshold application, zero substitution, success, or failure.
D09 denominator, missingness, exclusion, and partial-response semantics remain
unchanged.

D10 introduces no baseline or D11 behavior, validation criterion, p-value,
alpha, confidence interval, hypothesis test, multiplicity correction, composite
or global threshold, weighted score, ranking, pass/fail decision, model-quality
decision, ML threshold, reliability/SEM formula, or engineering/product/
application flag. Thresholds remain semantically distinct from baselines,
validation, and statistical significance. The active metric set remains exactly
D09's Pearson, descriptive distributions, and coverage/missingness; D10 activates
no additional metric.

No human data, empirical threshold, or normative threshold is introduced. Future
rule content, numerical values, derivation methods, reliability/precision methods,
measurement-invariance methods, and any study-specific application remain
deferred to separately authorized governance. D10 implementation does not make
Phase 6.15 or D09 executable.

## D11 baseline and comparator boundary

`D11 Baseline & Comparator Methodology v1.0.0` defines a baseline only as a
predefined contextual reference or comparator under explicitly governed,
scope-compatible conditions. It is never automatically ground truth,
psychological or emotional truth, a validity criterion, a threshold, a success
criterion, a ranking mechanism, a superiority score, or a recommendation.

The D11 taxonomy is closed to `CONSTANT` and `DETERMINISTIC_ABLATION`. A
constant contains explicit, scope-specific target outputs and has no universal
default or scientific midpoint. The historical `constant-midpoint` value set
remains only a Phase 6.9 software fixture. Deterministic ablation is restricted
to `ZERO_INTERACTION_WEIGHTS` and
`ZERO_PERSONALITY_SENSITIVITY_WEIGHTS`; it identifies the governed lineage,
neutralized mechanism, and preserved configuration but supplies no executable
ablation engine and supports no causal claim. All other baseline classes remain
deferred.

Definition, execution, and comparison identities are separate. A definition
snapshots its configuration, scope, provenance, justification, predefinition,
and independence evidence and receives canonical configuration, scope, and
definition hashes. Authority is a distinct versioned governance artifact bound
to the exact definition hash, and it must carry the governed D11 authority
requirement unchanged; D11 does not adjudicate the issuing body, so no external
authority service, registry, or signature scheme is assumed. Caller labels, IDs,
values, flags, metadata, or self-supplied hashes do not create authority. The
implementation validates declared external approval evidence but does not claim
to prove historical chronology or external authority by software alone.

Independence provenance distinguishes evaluation results, development/tuning
data, held-out data where applicable, and external references. Every definition
must declare either its derivation data sources or, explicitly, that no
derivation data exist; an empty source list is never evidence of independence,
absence of overlap, or absence of leakage. Each declared source states its
derivation use, its evaluation-data overlap status, its independence evidence
reference, and whether it was removed. Fitting, tuning, optimization, selection,
result reuse, and post-result construction are prohibited. Held-out data are not
universally required. Missing or ambiguous independence, predefinition,
provenance, or authority is fail-closed as `NOT_EVALUABLE`.

Compatibility is exact wherever semantically relevant: dataset ID/version/hash,
ordered case IDs, evaluation-contract version/hash, target output and dimension,
construct, scale, units, direction, observation unit, context, and relevant
model/parameter identities. A field may be `NOT_APPLICABLE` only with a reason.
Sharing a numeric range such as `[0,1]` does not establish construct equivalence.
Constant comparisons do not require candidate and baseline model identity
equality. Ablations do require the governed model/configuration lineage and
non-targeted configuration binding.

The D11 comparator answers only whether two governed results are descriptively
comparable. Its outcomes are `COMPARABLE`, `NOT_COMPARABLE`, and
`NOT_EVALUABLE`, each with explicit reasons. Missing, invalid, undefined, or
non-finite metric evidence is never converted to zero. Comparison artifacts are
deep immutable snapshots with their own canonical hash. Multiple baselines are
represented only by independent pairwise artifacts; order conveys no priority,
and there is no aggregate, primary baseline, winner, ranking, score, threshold,
pass/fail decision, or model recommendation.

D11 activates no metric. D09 remains authoritative for Pearson, descriptive
distributions, coverage/missingness, and their non-inferential interpretation.
D10 remains `NO_THRESHOLD_DEFINED`; a baseline cannot create a threshold and a
threshold cannot create a baseline. Phase 6.15 remains `HUMAN DATA = NONE`,
`execution = NOT_IMPLEMENTED`, and `status = UNRESOLVED`. Human-derived
baselines, baseline selection or optimization, registries/databases, statistical
inference, calibration, ML training, psychometrics, and human execution remain
outside D11.
