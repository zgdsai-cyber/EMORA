import { canonicalize, hashCanonical } from '../canonicalize';
import {
  MATHEMATICAL_DECISION_REGISTER_1_0_0,
} from '../candidate-comparison/contracts';
import { createCandidateComparisonArtifact } from '../candidate-comparison/validation';
import { SYNTHETIC_PROPERTY_FAMILIES_BY_COMPONENT } from './contracts';
import type {
  DeferredHybridFusionArtifact,
  ExecutableFormulationSpecification,
  NumericFormulationExecutor,
  NumericTolerance,
  ReevaluableComponent,
  SyntheticAssertion,
  SyntheticPropertyCase,
  SyntheticPropertyResult,
  SyntheticReevaluationArtifact,
  SyntheticReevaluationPlan,
  SyntheticRunObservation,
} from './contracts';

const HASH_PATTERN = /^[0-9a-f]{64}$/;

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      freeze(nested);
  }
  return value;
}

function snapshot<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => snapshot(item)) as T;
  if (Object.getPrototypeOf(value) !== Object.prototype)
    throw new TypeError('Synthetic re-evaluation data must use plain objects.');
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, snapshot(nested)]),
  ) as T;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new TypeError(`${field} must be finite and non-negative.`);
}

function missingSpecificationFields(
  formulation: ExecutableFormulationSpecification,
): string[] {
  const missing: string[] = [];
  if (!nonEmpty(formulation.construct)) missing.push('construct');
  if (!formulation.equation || !nonEmpty(formulation.equation.expression))
    missing.push('equation.expression');
  if (!formulation.equation || formulation.equation.variables.length === 0)
    missing.push('equation.variables');
  if (!nonEmpty(formulation.inputDomain)) missing.push('inputDomain');
  if (!nonEmpty(formulation.outputScale)) missing.push('outputScale');
  if (!nonEmpty(formulation.outputUnits)) missing.push('outputUnits');
  if (!formulation.parameters) missing.push('parameters');
  if (!nonEmpty(formulation.temporalAssumptions))
    missing.push('temporalAssumptions');
  if (!formulation.governedDecisionReference)
    missing.push('governedDecisionReference');
  if (
    formulation.formulationKind === 'CANDIDATE' &&
    !formulation.candidateReference
  )
    missing.push('candidateReference');
  for (const [index, variable] of (
    formulation.equation?.variables ?? []
  ).entries()) {
    if (
      !nonEmpty(variable.symbol) ||
      !nonEmpty(variable.definition) ||
      !nonEmpty(variable.domain) ||
      !nonEmpty(variable.scaleOrUnits)
    )
      missing.push(`equation.variables[${index}]`);
  }
  for (const [index, parameter] of (formulation.parameters ?? []).entries()) {
    if (
      !nonEmpty(parameter.symbol) ||
      !nonEmpty(parameter.definition) ||
      !nonEmpty(parameter.domain) ||
      !nonEmpty(parameter.scaleOrUnits)
    )
      missing.push(`parameters[${index}]`);
  }
  return missing;
}

function approximatelyEqual(
  left: number,
  right: number,
  tolerance: NumericTolerance,
): boolean {
  return (
    Math.abs(left - right) <=
    tolerance.absolute +
      tolerance.relative * Math.max(Math.abs(left), Math.abs(right))
  );
}

function toleranceAllowance(
  left: number,
  right: number,
  tolerance: NumericTolerance,
): number {
  return (
    tolerance.absolute +
    tolerance.relative * Math.max(Math.abs(left), Math.abs(right))
  );
}

function describeAssertion(assertion: SyntheticAssertion): string {
  switch (assertion.kind) {
    case 'FINITE_OUTPUTS':
      return `${assertion.outputKeys.join(', ')} are finite`;
    case 'OUTPUT_IN_RANGE':
      return `${assertion.outputKey} is in [${assertion.minimum}, ${assertion.maximum}]`;
    case 'OUTPUT_APPROX_EQUALS':
      return `${assertion.outputKey} approximately equals ${assertion.expected}`;
    case 'NON_DECREASING':
      return `${assertion.outputKey} is non-decreasing from ${assertion.firstRunId} to ${assertion.secondRunId}`;
    case 'NON_INCREASING':
      return `${assertion.outputKey} is non-increasing from ${assertion.firstRunId} to ${assertion.secondRunId}`;
    case 'MINIMUM_ABSOLUTE_DIFFERENCE':
      return `absolute ${assertion.outputKey} difference is at least ${assertion.minimumDifference}`;
  }
}

function evaluateAssertion(
  assertion: SyntheticAssertion,
  observations: ReadonlyMap<string, SyntheticRunObservation>,
  tolerance: NumericTolerance,
): { satisfied: boolean; observed: string } {
  const output = (runId: string, outputKey: string): number => {
    const value = observations.get(runId)?.output[outputKey];
    return typeof value === 'number' ? value : Number.NaN;
  };
  switch (assertion.kind) {
    case 'FINITE_OUTPUTS': {
      const values = assertion.outputKeys.map((key) =>
        output(assertion.runId, key),
      );
      return {
        satisfied: values.every(Number.isFinite),
        observed: `[${values.map(String).join(',')}]`,
      };
    }
    case 'OUTPUT_IN_RANGE': {
      const value = output(assertion.runId, assertion.outputKey);
      return {
        satisfied:
          Number.isFinite(value) &&
          value + toleranceAllowance(value, assertion.minimum, tolerance) >=
            assertion.minimum &&
          value - toleranceAllowance(value, assertion.maximum, tolerance) <=
            assertion.maximum,
        observed: String(value),
      };
    }
    case 'OUTPUT_APPROX_EQUALS': {
      const value = output(assertion.runId, assertion.outputKey);
      return {
        satisfied:
          Number.isFinite(value) &&
          approximatelyEqual(value, assertion.expected, tolerance),
        observed: String(value),
      };
    }
    case 'NON_DECREASING': {
      const first = output(assertion.firstRunId, assertion.outputKey);
      const second = output(assertion.secondRunId, assertion.outputKey);
      return {
        satisfied:
          Number.isFinite(first) &&
          Number.isFinite(second) &&
          second + toleranceAllowance(second, first, tolerance) >= first,
        observed: `first=${String(first)},second=${String(second)}`,
      };
    }
    case 'NON_INCREASING': {
      const first = output(assertion.firstRunId, assertion.outputKey);
      const second = output(assertion.secondRunId, assertion.outputKey);
      return {
        satisfied:
          Number.isFinite(first) &&
          Number.isFinite(second) &&
          second <= first + toleranceAllowance(second, first, tolerance),
        observed: `first=${String(first)},second=${String(second)}`,
      };
    }
    case 'MINIMUM_ABSOLUTE_DIFFERENCE': {
      const first = output(assertion.firstRunId, assertion.outputKey);
      const second = output(assertion.secondRunId, assertion.outputKey);
      const difference = Math.abs(second - first);
      return {
        satisfied:
          Number.isFinite(difference) &&
          difference +
            toleranceAllowance(
              difference,
              assertion.minimumDifference,
              tolerance,
            ) >=
            assertion.minimumDifference,
        observed: `first=${String(first)},second=${String(second)},difference=${String(difference)}`,
      };
    }
  }
}

function observeRuns(
  evaluationCase: SyntheticPropertyCase<ReevaluableComponent>,
  execute: NumericFormulationExecutor,
): SyntheticRunObservation[] {
  return evaluationCase.runs.map((run) => {
    const normalizeOutput = (
      output: Readonly<Record<string, number>>,
    ): SyntheticRunObservation['output'] =>
      Object.fromEntries(
        Object.entries(snapshot(output)).map(([key, value]) => {
          if (!nonEmpty(key) || typeof value !== 'number')
            throw new TypeError('Formulation outputs must be numeric records.');
          return [
            key,
            Number.isNaN(value)
              ? 'NaN'
              : value === Number.POSITIVE_INFINITY
                ? 'POSITIVE_INFINITY'
                : value === Number.NEGATIVE_INFINITY
                  ? 'NEGATIVE_INFINITY'
                  : value,
          ];
        }),
      );
    const first = normalizeOutput(execute(freeze(snapshot(run.input))));
    const second = normalizeOutput(execute(freeze(snapshot(run.input))));
    return {
      runId: run.runId,
      input: snapshot(run.input),
      output: first,
      repeatedOutput: second,
    };
  });
}

function evaluateCase(
  evaluationCase: SyntheticPropertyCase<ReevaluableComponent>,
  execute: NumericFormulationExecutor,
  tolerance: NumericTolerance,
  missingFields: readonly string[],
): SyntheticPropertyResult {
  if (evaluationCase.applicability === 'NOT_APPLICABLE')
    return {
      caseId: evaluationCase.caseId,
      propertyFamily: evaluationCase.propertyFamily,
      property: evaluationCase.property,
      status: 'NOT_APPLICABLE',
      observations: [],
      reason: evaluationCase.reason,
    };
  if (missingFields.length > 0)
    return {
      caseId: evaluationCase.caseId,
      propertyFamily: evaluationCase.propertyFamily,
      property: evaluationCase.property,
      status: 'NOT_EVALUABLE',
      observations: [],
      reason: `Missing executable specification: ${missingFields.join(', ')}.`,
    };
  if (!evaluationCase.assertion)
    return {
      caseId: evaluationCase.caseId,
      propertyFamily: evaluationCase.propertyFamily,
      property: evaluationCase.property,
      status: 'NOT_EVALUABLE',
      observations: [],
      reason: 'Executable case has no predefined assertion.',
    };

  const observations = observeRuns(evaluationCase, execute);
  const deterministic = observations.every(
    (observation) =>
      canonicalize(observation.output) ===
      canonicalize(observation.repeatedOutput),
  );
  const expected = describeAssertion(evaluationCase.assertion);
  const assertionResult = evaluateAssertion(
    evaluationCase.assertion,
    new Map(observations.map((observation) => [observation.runId, observation])),
    tolerance,
  );
  const satisfied = deterministic && assertionResult.satisfied;
  const observed = deterministic
    ? assertionResult.observed
    : 'Repeated execution produced different canonical outputs.';
  return {
    caseId: evaluationCase.caseId,
    propertyFamily: evaluationCase.propertyFamily,
    property: evaluationCase.property,
    status: satisfied ? 'SATISFIED' : 'VIOLATED',
    observations,
    expected,
    observed,
    counterexample: satisfied
      ? undefined
      : { caseId: evaluationCase.caseId, property: evaluationCase.property, runs: observations, expected, observed },
  };
}

function validateFormulationAuthority(
  formulation: ExecutableFormulationSpecification,
): void {
  const governed = formulation.governedDecisionReference;
  if (governed) {
    const frozen = MATHEMATICAL_DECISION_REGISTER_1_0_0[formulation.component];
    if (
      governed.registerVersion !== '1.0.0' ||
      governed.decisionId !== frozen.decisionId ||
      governed.currentDecision !== frozen.currentDecision
    )
      throw new TypeError(
        'Formulation authority must match the frozen mathematical decision register.',
      );
  }

  const reference = formulation.candidateReference;
  if (formulation.formulationKind === 'CURRENT_EMORA') {
    if (reference)
      throw new TypeError(
        'CURRENT_EMORA formulations must not declare a candidate reference.',
      );
    return;
  }
  if (!reference) return;

  const artifact = reference.comparisonArtifact;
  if (
    artifact.component !== formulation.component ||
    reference.candidateId !== formulation.formulationId
  )
    throw new TypeError(
      'Candidate reference component and id must match the formulation.',
    );
  const rebuilt = createCandidateComparisonArtifact({
    artifactId: artifact.artifactId,
    artifactVersion: artifact.artifactVersion,
    component: artifact.component,
    governedDecisionReference: artifact.governedDecisionReference,
    currentFormulationSummary: artifact.currentFormulationSummary,
    candidates: artifact.candidates,
  });
  if (rebuilt.artifactHash !== artifact.artifactHash)
    throw new TypeError('Candidate comparison artifact hash is invalid.');
  const candidate = artifact.candidates.find(
    (item) => item.candidateId === reference.candidateId,
  );
  if (!candidate || candidate.family !== reference.family)
    throw new TypeError(
      'Candidate id and family must exist in the referenced Phase 6.13 artifact.',
    );
  if (
    governed?.decisionId !== artifact.governedDecisionReference.decisionId ||
    governed.currentDecision !==
      artifact.governedDecisionReference.currentDecision ||
    governed.registerVersion !==
      artifact.governedDecisionReference.registerVersion
  )
    throw new TypeError(
      'Candidate and formulation governed decision references must match.',
    );
  if (
    formulation.equation?.expression !== candidate.equation.expression ||
    canonicalize(
      formulation.equation?.variables.map(
        ({ symbol, definition, scaleOrUnits }) => ({
          symbol,
          definition,
          unitsOrScale: scaleOrUnits,
        }),
      ) ?? [],
    ) !== canonicalize(candidate.equation.variables)
  )
    throw new TypeError(
      'Executable candidate equation must match its Phase 6.13 record.',
    );
}

function validatePlan<C extends ReevaluableComponent>(
  plan: SyntheticReevaluationPlan<C>,
): void {
  if (!(plan.component in SYNTHETIC_PROPERTY_FAMILIES_BY_COMPONENT))
    throw new TypeError(
      'HYBRID_FUSION is DEFERRED and cannot be executed in Phase 6.14.',
    );
  if (plan.component !== plan.formulation.component)
    throw new TypeError('Plan and formulation components must match.');
  validateFormulationAuthority(plan.formulation);
  assertFiniteNonNegative(plan.tolerance.absolute, 'tolerance.absolute');
  assertFiniteNonNegative(plan.tolerance.relative, 'tolerance.relative');
  if (!nonEmpty(plan.tolerance.rationale))
    throw new TypeError('tolerance.rationale is required.');
  if (!HASH_PATTERN.test(plan.provenance.configurationHash))
    throw new TypeError('provenance.configurationHash must be a SHA-256 hash.');
  if (!HASH_PATTERN.test(plan.provenance.executorHash))
    throw new TypeError('provenance.executorHash must be a SHA-256 hash.');
  const caseIds = new Set<string>();
  for (const evaluationCase of plan.cases) {
    if (caseIds.has(evaluationCase.caseId))
      throw new TypeError(`Duplicate case id ${evaluationCase.caseId}.`);
    caseIds.add(evaluationCase.caseId);
    const componentFamilies = SYNTHETIC_PROPERTY_FAMILIES_BY_COMPONENT[
      plan.component
    ] as readonly string[];
    if (!componentFamilies.includes(evaluationCase.propertyFamily))
      throw new TypeError(
        `${evaluationCase.propertyFamily} is not declared for ${plan.component}.`,
      );
    const runIds = evaluationCase.runs.map((run) => run.runId);
    if (new Set(runIds).size !== runIds.length)
      throw new TypeError(`Case ${evaluationCase.caseId} repeats a run id.`);
  }
  canonicalize(plan);
}

export function evaluateSyntheticReevaluation<
  C extends ReevaluableComponent,
>(
  input: SyntheticReevaluationPlan<C>,
  execute: NumericFormulationExecutor,
): SyntheticReevaluationArtifact<C> {
  const plan = snapshot(input);
  validatePlan(plan);
  const missingFields = missingSpecificationFields(plan.formulation);
  const results = plan.cases.map((evaluationCase) =>
    evaluateCase(
      evaluationCase as SyntheticPropertyCase<ReevaluableComponent>,
      execute,
      plan.tolerance,
      missingFields,
    ),
  );
  const content = {
    ...plan,
    scope: 'COMPONENT_LOCAL_SYNTHETIC_MATHEMATICAL' as const,
    disposition: 'EVALUATED' as const,
    results,
  };
  return freeze({ ...content, artifactHash: hashCanonical(content) });
}

export function createDeferredHybridFusionArtifact(): DeferredHybridFusionArtifact {
  const content = {
    component: 'HYBRID_FUSION' as const,
    scope: 'COMPONENT_LOCAL_SYNTHETIC_MATHEMATICAL' as const,
    disposition: 'DEFERRED' as const,
    reason:
      'Phase 6.14 does not implement or evaluate Hybrid Fusion; MDR-009 remains DEFERRED.',
  };
  return freeze({ ...content, artifactHash: hashCanonical(content) });
}
