# EMORA Mathematical Decision Register

**Register version:** 1.0.0

**Decision date:** 2026-09-17

**Decision authority:** EMORA Phase 6.12 owner-approved Architecture / Methodology Gate

## Purpose and boundary

This register is a traceable governance artifact documenting what EMORA currently assumes, what evidence exists, what remains uncertain, and what conditions would justify revisiting a mathematical decision. It records the current frozen model; it does not select alternatives, modify equations, or constitute scientific validation.

> EMORA is an interpretable computational framework for modeling dynamic emotional states. Its architecture is informed by established research in appraisal theory, dimensional affect, individual differences in affective responsiveness, emotional memory, and emotion dynamics.
>
> EMORA does not currently claim to constitute a scientifically validated model of human emotion. Specific mathematical formulations, interaction parameters, temporal functions, and parameter values are treated as model hypotheses or engineering operationalizations unless independently supported by empirical evidence.
>
> Subsequent evaluation should test mathematical validity, model consistency, theoretical traceability, and, when suitable human data become available, empirical validity against predefined criteria and appropriate baselines.

The existence of related literature does not elevate an EMORA equation from an engineering operationalization to a scientifically validated model. This register is not a claim that the literature supports EMORA.

## Decision vocabulary

Only these decision terms are normative:

- **ADOPT:** use a verified external model or formulation without substantive alteration, after sufficient evidence and compatibility review.
- **ADAPT:** use a verified external basis with documented and justified changes for EMORA.
- **RETAIN:** keep the current model because there is no sufficient reason to change it.
- **REJECT:** decline a candidate because demonstrated incompatibility or evidence makes it unsuitable for the stated construct and purpose.
- **DEFER:** available information, data, or methodology is insufficient for a decision.

These decisions must not be paraphrased as unsupported claims that a model is “best,” “superior,” “scientifically proven,” or “psychologically correct.” A retained model is not thereby validated.

## Evidence taxonomy

Evidence categories are independent descriptions, not levels, rankings, or inputs to a scientific support score:

- **MATHEMATICAL:** boundedness, numerical validity, stability, convergence, monotonicity, determinism, and existence/uniqueness where applicable.
- **THEORETICAL:** traceability to a psychological, cognitive, affective, or dynamical construct or theory.
- **EMPIRICAL:** evaluation using actual human or behavioral observations under a defined protocol.
- **ENGINEERING:** implementation choices, parameterizations, clamps, mappings, priors, and operationalizations within EMORA.

Evidence in one category does not imply evidence in another. In particular, mathematical validity and synthetic agreement do not establish human psychological validity.

## Compatibility taxonomy

Every future candidate must be considered independently on these axes:

- **CONSTRUCT**
- **INPUT**
- **OUTPUT**
- **SCALE**
- **TEMPORAL**
- **PARAMETER**
- **COMPUTATIONAL**
- **INTERPRETABILITY**

Allowed values for each axis are:

- **COMPATIBLE**
- **PARTIALLY_COMPATIBLE**
- **INCOMPATIBLE**
- **UNKNOWN**

These values are independent descriptions. They must not be numerically combined, ranked, or converted into a score or winner.

## Literature verification protocol

Every candidate source must record:

1. candidate citation;
2. original source identity;
3. source availability;
4. exact equation;
5. equation page, section, or other location when available;
6. variable definitions;
7. units and scales;
8. temporal assumptions;
9. population or dataset;
10. validation performed;
11. reported limitations;
12. descriptive versus causal interpretation;
13. compatibility with the intended EMORA construct.

Allowed source-verification statuses are:

- **VERIFIED:** the original source was inspected and the recorded claims were checked directly.
- **UNVERIFIED:** a candidate source or claim exists, but the original source was not inspected sufficiently.
- **NOT LOCATED:** the claimed original source could not be found.
- **NOT APPLICABLE:** the verification field does not apply to the candidate.
- **NOT REPORTED:** the inspected source does not report the required information.

Externally generated citations, AI suggestions, and prior secondary reports begin as candidate sources. An `UNVERIFIED` or `NOT LOCATED` source cannot be decisive evidence. No original literature source was inspected during Phase 6.12; consequently, this register marks no literature source `VERIFIED`.

## Synthetic Evaluation ≠ Human Psychological Validity

Synthetic evaluation may examine mathematical behavior, structural consistency, determinism, regression behavior, and controlled candidate comparison in a future authorized phase. It cannot by itself establish that EMORA correctly represents human emotion.

The Phase 6.10 corpus is an `EXPERT_DESIGN`, `DESIGN` engineering/reference artifact. It is not human ground truth. Human behavioral evaluation remains a separate future methodology requiring suitable observations and predefined criteria.

EMORA currently uses MAE, RMSE, Pearson, and Spearman as distinct descriptive tools: absolute numerical error, sensitivity to larger errors, linear association, and rank association respectively. They must not be combined into a composite or overall model score, model ranking, winner, scientific support score, or automatic scientific label. No inferential statistics are authorized here.

## Current mathematical decisions

### MDR-001 — Event Impact

| Field | Record |
| --- | --- |
| **Decision ID** | `MDR-001` |
| **Register Version** | `1.0.0` |
| **Decision Date** | `2026-09-17` |
| **Decision Authority** | EMORA Phase 6.12 owner-approved gate |
| **Component** | Event Impact |
| **Construct** | Computational magnitude assigned to a structured event before emotion-specific influence. |
| **Construct Non-Claims** | Not a law of human emotion, a psychometric score, or a measured human response. |
| **Current EMORA Definition** | Product of event intensity, relevance, and an affine surprise factor using caller-validated parameters. |
| **Current Equation** | $I = intensity \times relevance \times (0.5 + 0.5 \times surprise)$ for default parameters. |
| **Inputs** | `event.intensity`, `event.relevance`, `event.surprise`; configured `surpriseBase`, `surpriseScale`. |
| **Outputs** | Scalar event impact. |
| **Scale / Units** | Dimensionless; $[0,1]$ for normalized inputs and default coefficients. |
| **Temporal Assumptions** | Instantaneous per transition; no duration or event history in this equation. |
| **Parameter Constraints** | Event inputs normalized to $[0,1]$; default surprise coefficients are `0.5`, validated in $[0,1]$. |
| **Current Implementation Status** | Implemented, deterministic, runtime validated. |
| **Current Decision** | **RETAIN** |
| **Deferred Sub-decisions** | Empirical/psychological validation: **DEFER**. Alternative impact forms: **DEFER**. |
| **Decision Rationale** | The formula is bounded and interpretable under current defaults. There is insufficient evidence to treat it as a validated psychological equation or to replace it now. |
| **Literature Candidates** | Appraisal-based event relevance, intensity, and novelty/surprise formulations. |
| **Primary Sources** | None verified in Phase 6.12. |
| **Source Verification Status** | **UNVERIFIED** |
| **Verified Equation / Page / Section** | **NOT APPLICABLE** — no source verified. |
| **Evidence Type** | **MATHEMATICAL**, **THEORETICAL**, **ENGINEERING**; **EMPIRICAL** evidence not established. |
| **Construct Compatibility** | **UNKNOWN** |
| **Input Compatibility** | **UNKNOWN** |
| **Output Compatibility** | **UNKNOWN** |
| **Scale Compatibility** | **UNKNOWN** |
| **Temporal Compatibility** | **UNKNOWN** |
| **Parameter Compatibility** | **UNKNOWN** |
| **Computational Compatibility** | **COMPATIBLE** with current runtime. |
| **Interpretability Compatibility** | **COMPATIBLE** with current runtime. |
| **Known Limitations** | Multiplicative zeroing, fixed default affine surprise term, and no empirical calibration. |
| **Synthetic Evaluation Need** | Bounds, determinism, local monotonicity under fixed nonnegative inputs, and regression behavior. |
| **Human Evaluation Need** | Predefined appraisal protocol with suitable behavioral observations. |
| **Revisit Trigger** | Verified literature materially changes the comparison; controlled synthetic evaluation reveals a specific limitation; suitable human appraisal data become available. |
| **Decision History** | `2026-09-17`: current equation recorded; **RETAIN**, empirical validation **DEFER**. |
| **Implementation Location** | `packages/emotional-core/src/dynamics/event-impact.ts` |
| **Equation Source in Repository** | `calculateEventImpact()` and defaults in `packages/emotional-core/src/parameters/model-parameters.ts` |

### MDR-002 — Personality Modifier

| Field | Record |
| --- | --- |
| **Decision ID** | `MDR-002` |
| **Register Version** | `1.0.0` |
| **Decision Date** | `2026-09-17` |
| **Decision Authority** | EMORA Phase 6.12 owner-approved gate |
| **Component** | Personality Modifier |
| **Construct** | Computational modulation of emotion influence using normalized model traits. |
| **Construct Non-Claims** | Not a validated individual-difference model, personality assessment, diagnosis, or universal response law. |
| **Current EMORA Definition** | Nonnegative affine modifier centered at trait value `0.5`. |
| **Current Equation** | $M(t)=\max(0,\ 1+w(t-0.5))$. |
| **Inputs** | Normalized trait $t$ and nonnegative sensitivity weight $w$. |
| **Outputs** | Nonnegative scalar modifier per supported trait. |
| **Scale / Units** | Dimensionless modifier; no psychometric unit. |
| **Temporal Assumptions** | Trait is constant within a transition; no trait evolution. |
| **Parameter Constraints** | Trait in $[0,1]$; weight finite and nonnegative; configured personality weights validated in $[0,2]$. |
| **Current Implementation Status** | Implemented and deterministic; trait-to-emotion mapping applied in the transition pipeline. |
| **Current Decision** | **RETAIN** |
| **Deferred Sub-decisions** | Individual-difference empirical validation: **DEFER**. Alternative centering or nonlinear modulation: **DEFER**. |
| **Decision Rationale** | The form is simple and interpretable. Centering at `0.5` and linearity are engineering assumptions, not validated psychological facts. |
| **Literature Candidates** | Individual differences in affective responsiveness and personality-conditioned appraisal models. |
| **Primary Sources** | None verified in Phase 6.12. |
| **Source Verification Status** | **UNVERIFIED** |
| **Verified Equation / Page / Section** | **NOT APPLICABLE** — no source verified. |
| **Evidence Type** | **MATHEMATICAL**, **THEORETICAL**, **ENGINEERING**; **EMPIRICAL** evidence not established. |
| **Construct Compatibility** | **UNKNOWN** |
| **Input Compatibility** | **UNKNOWN** |
| **Output Compatibility** | **UNKNOWN** |
| **Scale Compatibility** | **UNKNOWN** |
| **Temporal Compatibility** | **UNKNOWN** |
| **Parameter Compatibility** | **UNKNOWN** |
| **Computational Compatibility** | **COMPATIBLE** with current runtime. |
| **Interpretability Compatibility** | **COMPATIBLE** with current runtime. |
| **Known Limitations** | Linear response, fixed midpoint, trait mapping assumptions, and no empirical calibration. |
| **Synthetic Evaluation Need** | Bounds, midpoint behavior, weight-zero behavior, monotonicity under fixed weight, determinism, and regression. |
| **Human Evaluation Need** | Individual-difference observations under a predefined design and measurement protocol. |
| **Revisit Trigger** | Suitable individual-difference data; verified construct-matched literature; a specific synthetic limitation. |
| **Decision History** | `2026-09-17`: current equation recorded; **RETAIN**, empirical validation **DEFER**. |
| **Implementation Location** | `packages/emotional-core/src/dynamics/personality-modulation.ts`; mapping in `packages/emotional-core/src/dynamics/calculate-next-state.ts` |
| **Equation Source in Repository** | `calculateTraitModifier()` |

### MDR-003 — Valence

| Field | Record |
| --- | --- |
| **Decision ID** | `MDR-003` |
| **Register Version** | `1.0.0` |
| **Decision Date** | `2026-09-17` |
| **Decision Authority** | EMORA Phase 6.12 owner-approved gate |
| **Component** | Valence |
| **Construct** | Signed continuous affect summary in the current state representation. |
| **Construct Non-Claims** | Not a validated human valence measurement or proof that the selected emotion groupings are universal. |
| **Current EMORA Definition** | Difference between selected positive and negative emotion averages plus a weighted event-valence contribution, clamped to the signed range. |
| **Current Equation** | $V=clamp_{[-1,1]}((love+trust+joy)/3-(fear+jealousy+anger)/3+0.25\times eventValence)$. |
| **Inputs** | Next emotion vector and structured event valence. |
| **Outputs** | `state.dimensions.valence`. |
| **Scale / Units** | Dimensionless signed normalized value in $[-1,1]$. |
| **Temporal Assumptions** | Computed for each resulting state; no independent valence dynamics. |
| **Parameter Constraints** | Emotion values in $[0,1]$; event valence in $[-1,1]$; fixed contribution coefficient `0.25`. |
| **Current Implementation Status** | Implemented, clamped, deterministic. |
| **Current Decision** | **RETAIN** |
| **Deferred Sub-decisions** | Empirical validation of the exact grouping, averaging, and `0.25` coefficient: **DEFER**. |
| **Decision Rationale** | Dimensional affect has theoretical precedent, while this exact EMORA aggregation remains an engineering operationalization. |
| **Literature Candidates** | Dimensional affect and valence representations. |
| **Primary Sources** | None verified in Phase 6.12. |
| **Source Verification Status** | **UNVERIFIED** |
| **Verified Equation / Page / Section** | **NOT APPLICABLE** — no source verified. |
| **Evidence Type** | **MATHEMATICAL**, **THEORETICAL**, **ENGINEERING**; **EMPIRICAL** evidence not established. |
| **Construct Compatibility** | **UNKNOWN** |
| **Input Compatibility** | **UNKNOWN** |
| **Output Compatibility** | **UNKNOWN** |
| **Scale Compatibility** | **UNKNOWN** |
| **Temporal Compatibility** | **UNKNOWN** |
| **Parameter Compatibility** | **UNKNOWN** |
| **Computational Compatibility** | **COMPATIBLE** with current runtime. |
| **Interpretability Compatibility** | **COMPATIBLE** with current runtime. |
| **Known Limitations** | Fixed groupings, equal averaging, omission of nostalgia, and unvalidated event coefficient. |
| **Synthetic Evaluation Need** | Bounds, sign behavior under controlled inputs, determinism, and regression. |
| **Human Evaluation Need** | Construct-aligned human valence observations and predefined comparison criteria. |
| **Revisit Trigger** | Verified dimensional-affect source comparison; suitable human data; synthetic evidence of a specific inconsistency. |
| **Decision History** | `2026-09-17`: current equation recorded; **RETAIN**. |
| **Implementation Location** | `packages/emotional-core/src/dynamics/continuous-dimensions.ts` |
| **Equation Source in Repository** | `calculateContinuousDimensions()` |

### MDR-004 — Arousal

| Field | Record |
| --- | --- |
| **Decision ID** | `MDR-004` |
| **Register Version** | `1.0.0` |
| **Decision Date** | `2026-09-17` |
| **Decision Authority** | EMORA Phase 6.12 owner-approved gate |
| **Component** | Arousal |
| **Construct** | Continuous activation summary derived from selected emotion-vector components. |
| **Construct Non-Claims** | Not a validated physiological or psychometric arousal measurement. |
| **Current EMORA Definition** | Equal mean of fear, anger, joy, and jealousy. |
| **Current Equation** | $A=(fear+anger+joy+jealousy)/4$. |
| **Inputs** | Next emotion vector. |
| **Outputs** | `state.dimensions.arousal`. |
| **Scale / Units** | Dimensionless normalized value in $[0,1]$. |
| **Temporal Assumptions** | Computed per resulting state; no independent arousal dynamics. |
| **Parameter Constraints** | Four inputs each validated in $[0,1]$; no configurable weights. |
| **Current Implementation Status** | Implemented, validated, deterministic. |
| **Current Decision** | **RETAIN** |
| **Deferred Sub-decisions** | Validation of selected components and equal weights: **DEFER**. |
| **Decision Rationale** | Arousal is theoretically traceable, but construct precedent does not validate EMORA’s exact dimensions or weights. |
| **Literature Candidates** | Dimensional affect and activation/arousal representations. |
| **Primary Sources** | None verified in Phase 6.12. |
| **Source Verification Status** | **UNVERIFIED** |
| **Verified Equation / Page / Section** | **NOT APPLICABLE** — no source verified. |
| **Evidence Type** | **MATHEMATICAL**, **THEORETICAL**, **ENGINEERING**; **EMPIRICAL** evidence not established. |
| **Construct Compatibility** | **UNKNOWN** |
| **Input Compatibility** | **UNKNOWN** |
| **Output Compatibility** | **UNKNOWN** |
| **Scale Compatibility** | **UNKNOWN** |
| **Temporal Compatibility** | **UNKNOWN** |
| **Parameter Compatibility** | **UNKNOWN** |
| **Computational Compatibility** | **COMPATIBLE** with current runtime. |
| **Interpretability Compatibility** | **COMPATIBLE** with current runtime. |
| **Known Limitations** | Equal weighting and exclusion of three emotion dimensions lack empirical validation. |
| **Synthetic Evaluation Need** | Bounds, averaging, determinism, and controlled regression cases. |
| **Human Evaluation Need** | Construct-aligned human or physiological observations under a separate methodology. |
| **Revisit Trigger** | Verified literature comparison; appropriate human arousal data; a demonstrated synthetic limitation. |
| **Decision History** | `2026-09-17`: current equation recorded; **RETAIN**. |
| **Implementation Location** | `packages/emotional-core/src/dynamics/continuous-dimensions.ts` |
| **Equation Source in Repository** | `calculateContinuousDimensions()` |

### MDR-005 — Intensity

| Field | Record |
| --- | --- |
| **Decision ID** | `MDR-005` |
| **Register Version** | `1.0.0` |
| **Decision Date** | `2026-09-17` |
| **Decision Authority** | EMORA Phase 6.12 owner-approved gate |
| **Component** | Intensity |
| **Construct** | State-level mean magnitude of the seven current emotion dimensions. |
| **Construct Non-Claims** | Not a standardized psychometric intensity scale and not identical to event intensity. |
| **Current EMORA Definition** | Arithmetic mean of all seven emotion-vector components in the resulting state. |
| **Current Equation** | $Intensity_{state}=\sum_{e\in emotions}e/7$. |
| **Inputs** | Seven next-state emotion dimensions. |
| **Outputs** | `state.dimensions.intensity`. |
| **Scale / Units** | Dimensionless normalized value in $[0,1]$. |
| **Temporal Assumptions** | Computed per resulting state; no independent intensity dynamics. |
| **Parameter Constraints** | Seven emotion inputs in $[0,1]$; fixed divisor `7`. |
| **Current Implementation Status** | Implemented, validated, deterministic. |
| **Current Decision** | **RETAIN** |
| **Deferred Sub-decisions** | Construct clarification: **DEFER**. Empirical interpretation: **DEFER**. |
| **Decision Rationale** | The mean is a transparent state summary. Its relationship to psychological intensity is unresolved. `event.intensity` is an event input used in impact; `state.dimensions.intensity` is a derived output. They are distinct constructs/contracts. |
| **Literature Candidates** | Affect intensity and emotion magnitude constructs. |
| **Primary Sources** | None verified in Phase 6.12. |
| **Source Verification Status** | **UNVERIFIED** |
| **Verified Equation / Page / Section** | **NOT APPLICABLE** — no source verified. |
| **Evidence Type** | **MATHEMATICAL**, **THEORETICAL**, **ENGINEERING**; **EMPIRICAL** evidence not established. |
| **Construct Compatibility** | **UNKNOWN** |
| **Input Compatibility** | **UNKNOWN** |
| **Output Compatibility** | **UNKNOWN** |
| **Scale Compatibility** | **UNKNOWN** |
| **Temporal Compatibility** | **UNKNOWN** |
| **Parameter Compatibility** | **UNKNOWN** |
| **Computational Compatibility** | **COMPATIBLE** with current runtime. |
| **Interpretability Compatibility** | **COMPATIBLE** as an engineering summary. |
| **Known Limitations** | Equal weighting, possible cancellation of construct distinctions, and ambiguous naming relative to event intensity. |
| **Synthetic Evaluation Need** | Bounds, arithmetic correctness, distinct event/state semantics, determinism, and regression. |
| **Human Evaluation Need** | Operational definition and construct-aligned human intensity observations. |
| **Revisit Trigger** | Approved construct clarification; verified literature; suitable human data; demonstrated inadequacy of equal averaging. |
| **Decision History** | `2026-09-17`: current equation recorded; **RETAIN**, construct clarification **DEFER**. |
| **Implementation Location** | `packages/emotional-core/src/dynamics/continuous-dimensions.ts`; event input in `packages/emotional-core/src/domain/emotional-event.ts` |
| **Equation Source in Repository** | `calculateContinuousDimensions()` |

### MDR-006 — Memory / Memory Decay

| Field | Record |
| --- | --- |
| **Decision ID** | `MDR-006` |
| **Register Version** | `1.0.0` |
| **Decision Date** | `2026-09-17` |
| **Decision Authority** | EMORA Phase 6.12 owner-approved gate |
| **Component** | Memory / Memory Decay |
| **Construct** | Time-decayed computational influence of supplied emotional memories on the current transition. |
| **Construct Non-Claims** | Not a validated law of human forgetting, recall, autobiographical memory, or emotional-memory persistence. |
| **Current EMORA Definition** | Exponential strength from memory intensity, importance, decay rate, and elapsed seconds; weighted vector difference contributes to each emotion. Future memories contribute zero. |
| **Current Equation** | $S=intensity\times importance\times\exp(-decayRate\times elapsedSeconds)$; $memoryInfluence_e=(memory_e-current_e)\times S\times memoryWeight_e$. |
| **Inputs** | Memory timestamp, reference timestamp, memory intensity, importance, `EmotionalMemory.decayRate`, memory emotion vector, current vector, per-emotion memory weights. |
| **Outputs** | Scalar memory strength and per-emotion influence vector. |
| **Scale / Units** | Intensity/importance and emotion values normalized; elapsed time in seconds; runtime meaning/units of `decayRate` are unresolved beyond inverse-seconds implied by the exponent. |
| **Temporal Assumptions** | Exponential decay from memory timestamp to event/reference timestamp; zero influence for a future memory; no retrieval or consolidation process. |
| **Parameter Constraints** | Domain validation applies to memory fields; per-emotion memory weights validated in $[0,1]$; finite timestamps required. |
| **Current Implementation Status** | Exponential decay is implemented and deterministic. Existing `docs/emotional-model.md` text stating that no decay equation is implemented conflicts with runtime code; runtime implementation is authoritative for behavior, and the discrepancy is recorded rather than repaired here. |
| **Current Decision** | **RETAIN** |
| **Deferred Sub-decisions** | Selection among exponential, power-law, and hyperbolic candidates: **DEFER**. Empirical time-scale interpretation: **DEFER**. |
| **Decision Rationale** | The current exponential form is executable and interpretable, but no candidate is selected or validated as a human-memory model. |
| **Literature Candidates** | Exponential decay; power-law decay; hyperbolic decay. No candidate is adopted in Phase 6.12. |
| **Primary Sources** | None verified in Phase 6.12. |
| **Source Verification Status** | **UNVERIFIED** |
| **Verified Equation / Page / Section** | **NOT APPLICABLE** — no source verified. |
| **Evidence Type** | **MATHEMATICAL**, **THEORETICAL**, **ENGINEERING**; **EMPIRICAL** evidence not established. |
| **Construct Compatibility** | **UNKNOWN** |
| **Input Compatibility** | **UNKNOWN** |
| **Output Compatibility** | **UNKNOWN** |
| **Scale Compatibility** | **UNKNOWN** |
| **Temporal Compatibility** | **UNKNOWN** |
| **Parameter Compatibility** | **UNKNOWN** |
| **Computational Compatibility** | **COMPATIBLE** with current runtime. |
| **Interpretability Compatibility** | **COMPATIBLE** with current runtime. |
| **Known Limitations** | Time-scale meaning is unresolved; no retrieval semantics; additive memories; future-memory policy; documentation/code discrepancy. `LearnableParameterSet.learnable.memoryDecayRate` and runtime `EmotionalMemory.decayRate` are distinct contracts; no mapping or conversion is defined or implied. |
| **Synthetic Evaluation Need** | Bounds, zero decay, non-increasing positive decay, future-memory behavior, elapsed-seconds sensitivity, determinism, and candidate behavior in a later authorized comparison. |
| **Human Evaluation Need** | Appropriate longitudinal memory data and predefined retention/recall construct and time scale. |
| **Revisit Trigger** | Suitable longitudinal human data; controlled candidate evaluation reveals a specific limitation; verified literature materially changes candidate comparison; governance resolves decay-rate contract semantics. |
| **Decision History** | `2026-09-17`: implemented exponential model recorded; **RETAIN**, candidate choice **DEFER**. |
| **Implementation Location** | `packages/emotional-core/src/dynamics/memory-influence.ts` |
| **Equation Source in Repository** | `calculateMemoryStrength()` and `calculateMemoryInfluence()` |

### MDR-007 — Temporal Dynamics

| Field | Record |
| --- | --- |
| **Decision ID** | `MDR-007` |
| **Register Version** | `1.0.0` |
| **Decision Date** | `2026-09-17` |
| **Decision Authority** | EMORA Phase 6.12 owner-approved gate |
| **Component** | Temporal Dynamics |
| **Construct** | Per-transition return-to-baseline stability mechanism after current influences are combined. |
| **Construct Non-Claims** | Not a validated model of human emotional recovery, temporal causality, or continuous-time affect dynamics. |
| **Current EMORA Definition** | Add current delta and a baseline-restoring term, then clamp independently per emotion. |
| **Current Equation** | $next_e=clamp_{[0,1]}(current_e+\Delta_e+rate\times(baseline_e-current_e))$. |
| **Inputs** | Current emotion vector, combined finite delta, stability rate, baseline vector. |
| **Outputs** | Next bounded emotion vector. |
| **Scale / Units** | Emotion values in $[0,1]$; dimensionless per-transition rate in $[0,1]$. No elapsed-time unit enters this equation. |
| **Temporal Assumptions** | Discrete one-step transition; rate is per invocation, not explicitly normalized by elapsed duration. |
| **Parameter Constraints** | Rate and baseline values in $[0,1]$; finite delta; output clamped to $[0,1]$. |
| **Current Implementation Status** | Implemented, deterministic, runtime validated. |
| **Current Decision** | **RETAIN** |
| **Deferred Sub-decisions** | Alternative temporal formulations and elapsed-time semantics: **DEFER**. |
| **Decision Rationale** | The mechanism is simple, bounded, and interpretable, but does not establish human temporal validity. |
| **Literature Candidates** | DynAffect; network dynamics; ODE/SDE and stochastic affect dynamics, as candidate comparison families only. |
| **Primary Sources** | None verified in Phase 6.12. |
| **Source Verification Status** | **UNVERIFIED** |
| **Verified Equation / Page / Section** | **NOT APPLICABLE** — no source verified. |
| **Evidence Type** | **MATHEMATICAL**, **THEORETICAL**, **ENGINEERING**; **EMPIRICAL** evidence not established. |
| **Construct Compatibility** | **UNKNOWN** |
| **Input Compatibility** | **UNKNOWN** |
| **Output Compatibility** | **UNKNOWN** |
| **Scale Compatibility** | **UNKNOWN** |
| **Temporal Compatibility** | **UNKNOWN** |
| **Parameter Compatibility** | **UNKNOWN** |
| **Computational Compatibility** | **COMPATIBLE** with current runtime. |
| **Interpretability Compatibility** | **COMPATIBLE** with current runtime. |
| **Known Limitations** | No elapsed-time term, fixed discrete update, clamp nonlinearity, no stochastic process, and no empirical calibration. |
| **Synthetic Evaluation Need** | Bounds, rate-zero behavior, baseline pull, determinism, stability behavior, and later candidate comparison. |
| **Human Evaluation Need** | Longitudinal behavioral data with explicit observation intervals and transition definitions. |
| **Revisit Trigger** | Suitable longitudinal data; verified temporal-model literature; synthetic evaluation reveals a specific discrete-time limitation. |
| **Decision History** | `2026-09-17`: current discrete equation recorded; **RETAIN**, alternatives **DEFER**. |
| **Implementation Location** | `packages/emotional-core/src/dynamics/temporal-stability.ts` |
| **Equation Source in Repository** | `applyTemporalStability()` |

### MDR-008 — Emotion Interaction Matrix

| Field | Record |
| --- | --- |
| **Decision ID** | `MDR-008` |
| **Register Version** | `1.0.0` |
| **Decision Date** | `2026-09-17` |
| **Decision Authority** | EMORA Phase 6.12 owner-approved gate |
| **Component** | Emotion Interaction Matrix |
| **Construct** | Configurable computational coupling/model prior among emotion influences. |
| **Construct Non-Claims** | Computational coupling does not establish causality. Matrix coefficients are not validated causal psychological effects. |
| **Current EMORA Definition** | One-pass weighted sum from every source influence to every target; the interaction output is not recursively fed through the matrix. |
| **Current Equation** | $interaction_{target}=\sum_{source} influence_{source}\times W[source,target]$. |
| **Inputs** | Valid emotion influence vector and complete interaction matrix. |
| **Outputs** | Per-target interaction influence vector. |
| **Scale / Units** | Input emotions normalized for validation at this boundary; coefficients in $[-1,1]$; interaction result is a finite additive influence before final clamping. |
| **Temporal Assumptions** | Instantaneous one-pass coupling within a transition; no lag or recurrence. |
| **Parameter Constraints** | Complete finite matrix; each coefficient in $[-1,1]$; domain sign policy protects trust from positive fear/anger contributions and disables `trust.negative`. |
| **Current Implementation Status** | Implemented, deterministic, one-pass, non-recursive, with validation and sign policy. |
| **Current Decision** | **RETAIN** |
| **Deferred Sub-decisions** | Empirical interpretation and alternative coupling structures: **DEFER**. |
| **Decision Rationale** | The matrix is explicit and inspectable. Its coefficients remain engineering priors rather than causal findings. |
| **Literature Candidates** | Emotion-network and dynamic coupling models. |
| **Primary Sources** | None verified in Phase 6.12. |
| **Source Verification Status** | **UNVERIFIED** |
| **Verified Equation / Page / Section** | **NOT APPLICABLE** — no source verified. |
| **Evidence Type** | **MATHEMATICAL**, **THEORETICAL**, **ENGINEERING**; **EMPIRICAL** evidence not established. |
| **Construct Compatibility** | **UNKNOWN** |
| **Input Compatibility** | **UNKNOWN** |
| **Output Compatibility** | **UNKNOWN** |
| **Scale Compatibility** | **UNKNOWN** |
| **Temporal Compatibility** | **UNKNOWN** |
| **Parameter Compatibility** | **UNKNOWN** |
| **Computational Compatibility** | **COMPATIBLE** with current runtime. |
| **Interpretability Compatibility** | **COMPATIBLE** with current runtime. |
| **Known Limitations** | One-pass linear coupling, fixed defaults, no learned causal interpretation, and no temporal lag. |
| **Synthetic Evaluation Need** | Matrix completeness, sign policy, one-pass behavior, bounded downstream state, deterministic ablations, and regression. |
| **Human Evaluation Need** | Longitudinal observations capable of testing directional relationships under a predefined non-causal/causal interpretation protocol. |
| **Revisit Trigger** | Appropriate longitudinal observations; verified construct-matched network literature; controlled evaluation reveals a specific coupling limitation. |
| **Decision History** | `2026-09-17`: one-pass coupling recorded; **RETAIN**. |
| **Implementation Location** | `packages/emotional-core/src/dynamics/emotion-interactions.ts`; policy in `packages/emotional-core/src/dynamics/interaction-policy.ts` |
| **Equation Source in Repository** | `applyEmotionInteractions()` |

### MDR-009 — Hybrid Fusion

| Field | Record |
| --- | --- |
| **Decision ID** | `MDR-009` |
| **Register Version** | `1.0.0` |
| **Decision Date** | `2026-09-17` |
| **Decision Authority** | EMORA Phase 6.12 owner-approved gate |
| **Component** | Hybrid Fusion |
| **Construct** | Deterministic interpolation contract between deterministic and future ML state estimates. |
| **Construct Non-Claims** | Not evidence that an ML model exists, is trained, calibrated, valid, or improves human-emotion modeling. |
| **Current EMORA Definition** | Component-wise weighted fusion with explicit endpoint selection and separately fused prediction confidence. |
| **Current Equation** | $hybrid=\alpha\times deterministic+(1-\alpha)\times ML$. |
| **Inputs** | Deterministic transition result, externally supplied ML prediction, fusion coefficient $\alpha$. |
| **Outputs** | Bounded hybrid emotional state, fused prediction confidence, and governed metadata. |
| **Scale / Units** | $\alpha\in[0,1]$; component outputs preserve declared state ranges. |
| **Temporal Assumptions** | Deterministic timestamp is canonical for intermediate fusion; exact selected-source timestamp at endpoints. No temporal ML model is defined. |
| **Parameter Constraints** | Finite normalized alpha; input predictions validated; outputs clamped; deep-copy/deep-freeze boundaries. |
| **Current Implementation Status** | Pure fusion contract/function implemented; no ML runtime, training, optimizer, calibration, dataset, or learning experiment. |
| **Current Decision** | **DEFER** |
| **Deferred Sub-decisions** | ML provider selection, training, calibration, alpha estimation, and empirical evaluation: **DEFER**. |
| **Decision Rationale** | The arithmetic boundary is implemented, but model/data readiness and empirical justification do not exist. No further hybrid decision is authorized. |
| **Literature Candidates** | Hybrid deterministic/learned fusion and ensemble calibration approaches. |
| **Primary Sources** | None verified in Phase 6.12. |
| **Source Verification Status** | **UNVERIFIED** |
| **Verified Equation / Page / Section** | **NOT APPLICABLE** — no source verified. |
| **Evidence Type** | **MATHEMATICAL**, **ENGINEERING**; candidate **THEORETICAL** and **EMPIRICAL** evidence not established. |
| **Construct Compatibility** | **UNKNOWN** |
| **Input Compatibility** | **UNKNOWN** |
| **Output Compatibility** | **UNKNOWN** |
| **Scale Compatibility** | **UNKNOWN** |
| **Temporal Compatibility** | **UNKNOWN** |
| **Parameter Compatibility** | **UNKNOWN** |
| **Computational Compatibility** | **COMPATIBLE** for the existing pure fusion function; ML runtime compatibility is **UNKNOWN**. |
| **Interpretability Compatibility** | **PARTIALLY_COMPATIBLE**: alpha is explicit, while a future ML source may not be intrinsically interpretable. |
| **Known Limitations** | No model provider, training data, calibration, learned parameters, empirical comparison, or approved alpha-selection method. |
| **Synthetic Evaluation Need** | Endpoint identity, bounded interpolation, determinism, metadata policy, and future controlled candidate comparison. |
| **Human Evaluation Need** | Appropriate held-out human data and a separate approved human methodology after ML readiness. |
| **Revisit Trigger** | ML readiness, governed provider and parameter identity, appropriate held-out human data, and an approved evaluation methodology. |
| **Decision History** | `2026-09-17`: current pure fusion boundary recorded; **DEFER**. |
| **Implementation Location** | `packages/emotional-core/src/learning/hybrid-fusion.ts`; contracts in `packages/emotional-core/src/learning/ml-provider.ts` |
| **Equation Source in Repository** | `fuseHybridPrediction()` |

## Known documentation and contract discrepancies

These observations are recorded without repair or invented conversion:

1. **Memory documentation/code discrepancy:** `docs/emotional-model.md` says no decay equation is implemented, while `calculateMemoryStrength()` implements exponential decay. Runtime code is authoritative for current behavior. This register does not edit the older document.
2. **Event intensity versus state intensity:** `event.intensity` is a structured event input to event impact. `state.dimensions.intensity` is the mean of seven resulting emotion dimensions. They are not one construct or a shared psychometric scale.
3. **Decay-rate time scale:** runtime decay uses `elapsedSeconds`; the empirical meaning and appropriate time scale of `decayRate` remain unresolved.
4. **Learnable versus runtime decay:** `LearnableParameterSet.learnable.memoryDecayRate` differs from runtime `EmotionalMemory.decayRate`. No mapping, conversion, activation, or equivalence is defined by this register.

## Revisit governance

A revisit trigger opens review; it does not automatically change an equation. Any reopened decision must:

1. identify the exact component and construct;
2. preserve old decision history;
3. verify original sources under this register’s protocol;
4. evaluate every compatibility axis independently;
5. predefine synthetic and, where applicable, human evaluation needs;
6. distinguish mathematical, theoretical, empirical, and engineering evidence;
7. pass a separate architecture/methodology gate before implementation.

## Future methodology sequence

```text
Mathematical Decision Register
  ↓
Candidate Mathematical Comparison
  ↓
Synthetic Mathematical Re-evaluation
  ↓
Human Methodology Gate
  ↓
Human Behavioral Evaluation
  ↓
Evidence Review / Model Selection
```

Phase 6.12 implements only the first governance artifact. It performs no candidate comparison, synthetic re-evaluation, human methodology, human evaluation, or model selection.

## Explicit non-goals

This register introduces:

- no equation changes;
- no emotional-core changes;
- no MDS changes;
- no redesign of the seven dimensions;
- no ML, training, optimizer, calibration, provider, model, or dataset;
- no human data or participant methodology;
- no candidate comparison or selection;
- no synthetic re-evaluation or corpus expansion;
- no parameter-lifecycle changes or parameter conversion;
- no baseline or comparator changes;
- no statistical inference, p-values, confidence intervals, hypothesis tests, multiplicity correction, or non-inferiority analysis;
- no composite score, overall model score, winner, ranking, or automatic support label;
- no infrastructure, API, UI, database, auth, Redis, BullMQ, or production change.
