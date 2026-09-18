import { hashCanonical } from '../canonicalize';
import {
  CANDIDATE_FAMILIES_BY_COMPONENT,
  COMPATIBILITY_AXES,
  COMPATIBILITY_VALUES,
  EVIDENCE_TYPES,
  GOVERNANCE_DECISIONS,
  HUMAN_EVALUATION_KINDS,
  INTENSITY_CONSTRUCTS,
  KNOWN_REGISTER_VERSIONS,
  MATHEMATICAL_COMPONENTS,
  MATHEMATICAL_DECISION_REGISTER_1_0_0,
  MEMORY_CONSTRUCTS,
  RELATION_KINDS,
  SOURCE_INTERPRETATIONS,
  SOURCE_STATUSES,
  SYNTHETIC_EVALUATION_KINDS,
  VERIFICATION_BASES,
} from './contracts';
import type {
  CandidateComparisonArtifact,
  CandidateComparisonArtifactInput,
  CandidateFormulationRecord,
  MathematicalComponent,
} from './contracts';

export type CandidateComparisonViolation =
  | 'INVALID_SHAPE'
  | 'FORBIDDEN_FIELD'
  | 'INVALID_COMPONENT'
  | 'INVALID_FAMILY'
  | 'DUPLICATE_CANDIDATE_ID'
  | 'COMPONENT_MISMATCH'
  | 'INVALID_SOURCE_STATUS'
  | 'INCOMPLETE_VERIFICATION'
  | 'INVALID_COMPATIBILITY'
  | 'INVALID_EVIDENCE_TYPE'
  | 'INVALID_CONSTRUCT_QUALIFIER'
  | 'UNSUPPORTED_CAUSAL_CLAIM'
  | 'EVIDENCE_CLASS_MISMATCH'
  | 'INVALID_GOVERNED_DECISION'
  | 'UNKNOWN_REGISTER_VERSION'
  | 'FROZEN_DECISION_MISMATCH';

export class CandidateComparisonValidationError extends Error {
  readonly violation: CandidateComparisonViolation;

  constructor(violation: CandidateComparisonViolation, message: string) {
    super(message);
    this.name = 'CandidateComparisonValidationError';
    this.violation = violation;
  }
}

function fail(violation: CandidateComparisonViolation, message: string): never {
  throw new CandidateComparisonValidationError(violation, message);
}

/** Field names that would encode a ranking, score, winner, or selection; rejected anywhere. */
export const FORBIDDEN_FIELD_NAMES = Object.freeze([
  'score',
  'rank',
  'ranking',
  'winner',
  'loser',
  'superiority',
  'superior',
  'best',
  'recommendation',
  'recommendedReplacement',
  'selected',
  'selection',
  'evidenceScore',
  'scientificScore',
  'confidenceScore',
  'candidateRank',
  'compatibilityScore',
  'overallCompatibility',
  'decision',
]);

const ARTIFACT_FIELDS = Object.freeze([
  'artifactId',
  'artifactVersion',
  'component',
  'governedDecisionReference',
  'currentFormulationSummary',
  'candidates',
]);

const CANDIDATE_FIELDS = Object.freeze([
  'candidateId',
  'component',
  'family',
  'label',
  'provenance',
  'equation',
  'constructMapping',
  'inputs',
  'outputs',
  'scale',
  'temporalAssumptions',
  'parameterAssumptions',
  'compatibility',
  'evidenceTypes',
  'limitations',
  'syntheticEvaluation',
  'humanEvaluation',
  'revisitTriggers',
  'analyticalObservations',
]);

const PROVENANCE_FIELDS = Object.freeze([
  'sourceStatus',
  'interpretation',
  'verificationBasis',
  'verifiedBy',
  'sourceTitle',
  'authors',
  'year',
  'publication',
  'identifier',
  'equationReference',
  'page',
  'section',
  'verificationNote',
]);

const QUALIFIER_FIELDS = Object.freeze([
  'intensityConstruct',
  'memoryConstruct',
  'relationKind',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) fail('INVALID_SHAPE', `${path} must be an object.`);
  return value;
}

function assertNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('INVALID_SHAPE', `${path} must be a non-empty string.`);
  }
  return value;
}

function assertStringArray(
  value: unknown,
  path: string,
  minLength: number,
): readonly string[] {
  if (!Array.isArray(value) || value.length < minLength) {
    fail(
      'INVALID_SHAPE',
      `${path} must be an array with at least ${minLength} item(s).`,
    );
  }
  value.forEach((item, index) =>
    assertNonEmptyString(item, `${path}[${index}]`),
  );
  return value as readonly string[];
}

function assertOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  violation: CandidateComparisonViolation,
  path: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(
      violation,
      `${path} must be one of ${allowed.join(', ')}; received ${JSON.stringify(value)}.`,
    );
  }
  return value as T;
}

/**
 * Rejects unknown fields anywhere in the object graph. This is what structurally
 * prevents score/rank/winner fields from entering a comparison artifact.
 */
function assertKnownFields(
  record: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_FIELD_NAMES.includes(key)) {
      fail(
        'FORBIDDEN_FIELD',
        `${path}.${key} is a forbidden ranking/scoring/selection field.`,
      );
    }
    if (!allowed.includes(key)) {
      fail('INVALID_SHAPE', `${path}.${key} is not a recognised field.`);
    }
  }
}

function validateProvenance(value: unknown, path: string): void {
  const provenance = assertRecord(value, path);
  assertKnownFields(provenance, PROVENANCE_FIELDS, path);
  const sourceStatus = assertOneOf(
    provenance.sourceStatus,
    SOURCE_STATUSES,
    'INVALID_SOURCE_STATUS',
    `${path}.sourceStatus`,
  );
  assertOneOf(
    provenance.interpretation,
    SOURCE_INTERPRETATIONS,
    'INVALID_SHAPE',
    `${path}.interpretation`,
  );
  for (const field of [
    'verifiedBy',
    'sourceTitle',
    'publication',
    'identifier',
    'equationReference',
    'page',
    'section',
    'verificationNote',
  ]) {
    if (provenance[field] !== undefined)
      assertNonEmptyString(provenance[field], `${path}.${field}`);
  }
  if (provenance.authors !== undefined)
    assertStringArray(provenance.authors, `${path}.authors`, 1);
  if (provenance.year !== undefined && !Number.isInteger(provenance.year)) {
    fail('INVALID_SHAPE', `${path}.year must be an integer.`);
  }
  if (provenance.verificationBasis !== undefined) {
    assertOneOf(
      provenance.verificationBasis,
      VERIFICATION_BASES,
      'INCOMPLETE_VERIFICATION',
      `${path}.verificationBasis`,
    );
  }
  if (sourceStatus === 'VERIFIED') {
    const required = [
      'verificationBasis',
      'verifiedBy',
      'sourceTitle',
      'authors',
      'year',
      'publication',
      'equationReference',
    ] as const;
    for (const field of required) {
      if (provenance[field] === undefined) {
        fail(
          'INCOMPLETE_VERIFICATION',
          `${path}.${field} is required when sourceStatus is VERIFIED.`,
        );
      }
    }
    if (provenance.page === undefined && provenance.section === undefined) {
      fail(
        'INCOMPLETE_VERIFICATION',
        `${path} must record page or section when sourceStatus is VERIFIED.`,
      );
    }
  } else if (
    provenance.verificationBasis !== undefined ||
    provenance.verifiedBy !== undefined
  ) {
    fail(
      'INCOMPLETE_VERIFICATION',
      `${path} may only declare verificationBasis/verifiedBy when sourceStatus is VERIFIED.`,
    );
  }
}

function validateEquation(value: unknown, path: string): void {
  const equation = assertRecord(value, path);
  assertKnownFields(equation, ['expression', 'variables'], path);
  assertNonEmptyString(equation.expression, `${path}.expression`);
  if (!Array.isArray(equation.variables))
    fail('INVALID_SHAPE', `${path}.variables must be an array.`);
  equation.variables.forEach((variable, index) => {
    const variablePath = `${path}.variables[${index}]`;
    const record = assertRecord(variable, variablePath);
    assertKnownFields(
      record,
      ['symbol', 'definition', 'unitsOrScale'],
      variablePath,
    );
    assertNonEmptyString(record.symbol, `${variablePath}.symbol`);
    assertNonEmptyString(record.definition, `${variablePath}.definition`);
    assertNonEmptyString(record.unitsOrScale, `${variablePath}.unitsOrScale`);
  });
}

function validateConstructMapping(
  value: unknown,
  component: MathematicalComponent,
  sourceStatus: string,
  interpretation: string,
  path: string,
): void {
  const mapping = assertRecord(value, path);
  assertKnownFields(
    mapping,
    ['emoraConstruct', 'candidateConstruct', 'qualifiers'],
    path,
  );
  assertNonEmptyString(mapping.emoraConstruct, `${path}.emoraConstruct`);
  assertNonEmptyString(
    mapping.candidateConstruct,
    `${path}.candidateConstruct`,
  );
  const qualifiers = assertRecord(mapping.qualifiers, `${path}.qualifiers`);
  assertKnownFields(qualifiers, QUALIFIER_FIELDS, `${path}.qualifiers`);

  const required: Record<string, MathematicalComponent> = {
    intensityConstruct: 'INTENSITY',
    memoryConstruct: 'MEMORY',
    relationKind: 'INTERACTION_MATRIX',
  };
  for (const [field, owner] of Object.entries(required)) {
    const present = qualifiers[field] !== undefined;
    if (owner === component && !present) {
      fail(
        'INVALID_CONSTRUCT_QUALIFIER',
        `${path}.qualifiers.${field} is required for component ${component}.`,
      );
    }
    if (owner !== component && present) {
      fail(
        'INVALID_CONSTRUCT_QUALIFIER',
        `${path}.qualifiers.${field} is only permitted for component ${owner}.`,
      );
    }
  }
  if (component === 'INTENSITY') {
    assertOneOf(
      qualifiers.intensityConstruct,
      INTENSITY_CONSTRUCTS,
      'INVALID_CONSTRUCT_QUALIFIER',
      `${path}.qualifiers.intensityConstruct`,
    );
  }
  if (component === 'MEMORY') {
    assertOneOf(
      qualifiers.memoryConstruct,
      MEMORY_CONSTRUCTS,
      'INVALID_CONSTRUCT_QUALIFIER',
      `${path}.qualifiers.memoryConstruct`,
    );
  }
  if (component === 'INTERACTION_MATRIX') {
    const relationKind = assertOneOf(
      qualifiers.relationKind,
      RELATION_KINDS,
      'INVALID_CONSTRUCT_QUALIFIER',
      `${path}.qualifiers.relationKind`,
    );
    // A causal relation may only be recorded as reported by an inspected source, never inferred from coupling.
    if (
      relationKind === 'CAUSALITY' &&
      (sourceStatus !== 'VERIFIED' || interpretation !== 'CAUSAL')
    ) {
      fail(
        'UNSUPPORTED_CAUSAL_CLAIM',
        `${path}.qualifiers.relationKind CAUSALITY requires a VERIFIED source with CAUSAL interpretation.`,
      );
    }
  }
}

function validateCompatibility(value: unknown, path: string): void {
  const compatibility = assertRecord(value, path);
  assertKnownFields(compatibility, COMPATIBILITY_AXES, path);
  for (const axis of COMPATIBILITY_AXES) {
    const axisPath = `${path}.${axis}`;
    if (compatibility[axis] === undefined)
      fail('INVALID_COMPATIBILITY', `${axisPath} is required.`);
    if (typeof compatibility[axis] === 'number') {
      fail('INVALID_COMPATIBILITY', `${axisPath} must not be numeric.`);
    }
    const assessment = assertRecord(compatibility[axis], axisPath);
    assertKnownFields(assessment, ['value', 'observation'], axisPath);
    assertOneOf(
      assessment.value,
      COMPATIBILITY_VALUES,
      'INVALID_COMPATIBILITY',
      `${axisPath}.value`,
    );
    if (assessment.observation !== undefined)
      assertNonEmptyString(assessment.observation, `${axisPath}.observation`);
  }
}

function validateEvidenceTypes(value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    fail(
      'INVALID_EVIDENCE_TYPE',
      `${path} must list at least one evidence type.`,
    );
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const type = assertOneOf(
      item,
      EVIDENCE_TYPES,
      'INVALID_EVIDENCE_TYPE',
      `${path}[${index}]`,
    );
    if (seen.has(type))
      fail('INVALID_EVIDENCE_TYPE', `${path} repeats ${type}.`);
    seen.add(type);
  });
}

function validateEvaluationPlan(
  value: unknown,
  expectedClass: 'SYNTHETIC_MATHEMATICAL' | 'HUMAN_BEHAVIORAL',
  path: string,
): void {
  const plan = assertRecord(value, path);
  assertKnownFields(plan, ['evidenceClass', 'requirements'], path);
  if (plan.evidenceClass !== expectedClass) {
    fail(
      'EVIDENCE_CLASS_MISMATCH',
      `${path}.evidenceClass must be ${expectedClass}; received ${JSON.stringify(plan.evidenceClass)}.`,
    );
  }
  if (!Array.isArray(plan.requirements))
    fail('INVALID_SHAPE', `${path}.requirements must be an array.`);
  const allowedKinds =
    expectedClass === 'SYNTHETIC_MATHEMATICAL'
      ? SYNTHETIC_EVALUATION_KINDS
      : HUMAN_EVALUATION_KINDS;
  plan.requirements.forEach((requirement, index) => {
    const requirementPath = `${path}.requirements[${index}]`;
    const record = assertRecord(requirement, requirementPath);
    assertKnownFields(record, ['kind', 'description'], requirementPath);
    assertOneOf(
      record.kind,
      allowedKinds,
      'EVIDENCE_CLASS_MISMATCH',
      `${requirementPath}.kind`,
    );
    assertNonEmptyString(record.description, `${requirementPath}.description`);
  });
}

function validateCandidate(
  value: unknown,
  component: MathematicalComponent,
  path: string,
): void {
  const candidate = assertRecord(value, path);
  assertKnownFields(candidate, CANDIDATE_FIELDS, path);
  assertNonEmptyString(candidate.candidateId, `${path}.candidateId`);
  const candidateComponent = assertOneOf(
    candidate.component,
    MATHEMATICAL_COMPONENTS,
    'INVALID_COMPONENT',
    `${path}.component`,
  );
  if (candidateComponent !== component) {
    fail(
      'COMPONENT_MISMATCH',
      `${path}.component ${candidateComponent} does not match artifact component ${component}.`,
    );
  }
  assertOneOf(
    candidate.family,
    CANDIDATE_FAMILIES_BY_COMPONENT[component],
    'INVALID_FAMILY',
    `${path}.family`,
  );
  assertNonEmptyString(candidate.label, `${path}.label`);
  validateProvenance(candidate.provenance, `${path}.provenance`);
  const provenance = candidate.provenance as Record<string, string>;
  validateEquation(candidate.equation, `${path}.equation`);
  validateConstructMapping(
    candidate.constructMapping,
    component,
    provenance.sourceStatus,
    provenance.interpretation,
    `${path}.constructMapping`,
  );
  assertStringArray(candidate.inputs, `${path}.inputs`, 1);
  assertStringArray(candidate.outputs, `${path}.outputs`, 1);
  assertNonEmptyString(candidate.scale, `${path}.scale`);
  assertNonEmptyString(
    candidate.temporalAssumptions,
    `${path}.temporalAssumptions`,
  );
  assertNonEmptyString(
    candidate.parameterAssumptions,
    `${path}.parameterAssumptions`,
  );
  validateCompatibility(candidate.compatibility, `${path}.compatibility`);
  validateEvidenceTypes(candidate.evidenceTypes, `${path}.evidenceTypes`);
  assertStringArray(candidate.limitations, `${path}.limitations`, 0);
  validateEvaluationPlan(
    candidate.syntheticEvaluation,
    'SYNTHETIC_MATHEMATICAL',
    `${path}.syntheticEvaluation`,
  );
  validateEvaluationPlan(
    candidate.humanEvaluation,
    'HUMAN_BEHAVIORAL',
    `${path}.humanEvaluation`,
  );
  assertStringArray(candidate.revisitTriggers, `${path}.revisitTriggers`, 0);
  assertStringArray(
    candidate.analyticalObservations,
    `${path}.analyticalObservations`,
    0,
  );
}

function validateGovernedDecisionReference(
  value: unknown,
  component: MathematicalComponent,
  path: string,
): void {
  const reference = assertRecord(value, path);
  assertKnownFields(
    reference,
    ['registerVersion', 'decisionId', 'currentDecision'],
    path,
  );
  const registerVersion = assertOneOf(
    reference.registerVersion,
    KNOWN_REGISTER_VERSIONS,
    'UNKNOWN_REGISTER_VERSION',
    `${path}.registerVersion`,
  );
  const decisionId = assertNonEmptyString(
    reference.decisionId,
    `${path}.decisionId`,
  );
  const currentDecision = assertOneOf(
    reference.currentDecision,
    GOVERNANCE_DECISIONS,
    'INVALID_GOVERNED_DECISION',
    `${path}.currentDecision`,
  );
  // Only register 1.0.0 is known; any other version was rejected above, so the frozen check always applies.
  const frozen = MATHEMATICAL_DECISION_REGISTER_1_0_0[component];
  if (
    frozen.decisionId !== decisionId ||
    frozen.currentDecision !== currentDecision
  ) {
    fail(
      'FROZEN_DECISION_MISMATCH',
      `${path} must match register ${registerVersion} for ${component}: ${frozen.decisionId} ${frozen.currentDecision}.`,
    );
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      deepFreeze(nested);
  }
  return value;
}

/**
 * Takes one inert snapshot before validation. Accessors and custom prototypes
 * are rejected so no caller code (for example an inherited `toJSON`) can alter
 * the content between validation and hashing.
 */
function snapshotData<T>(
  value: T,
  path: string,
  active = new WeakSet<object>(),
): T {
  if (typeof value !== 'object' || value === null) return value;
  if (active.has(value))
    fail('INVALID_SHAPE', `${path} must not contain a circular reference.`);
  active.add(value);

  if (Array.isArray(value)) {
    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (typeof key === 'symbol')
        fail('INVALID_SHAPE', `${path} must not contain symbol properties.`);
      if (key !== 'length') {
        const index = Number(key);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= value.length ||
          String(index) !== key
        ) {
          fail(
            'INVALID_SHAPE',
            `${path}.${key} is not a recognised array field.`,
          );
        }
      }
    }
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index))
        fail('INVALID_SHAPE', `${path}[${index}] must not be empty.`);
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        fail(
          'INVALID_SHAPE',
          `${path}[${index}] must be an enumerable data property.`,
        );
      }
      result.push(snapshotData(descriptor.value, `${path}[${index}]`, active));
    }
    active.delete(value);
    return result as T;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('INVALID_SHAPE', `${path} must be a plain data object.`);
  }
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol')
      fail('INVALID_SHAPE', `${path} must not contain symbol properties.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      fail(
        'INVALID_SHAPE',
        `${path}.${key} must be an enumerable data property.`,
      );
    }
    Object.defineProperty(result, key, {
      value: snapshotData(descriptor.value, `${path}.${key}`, active),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  active.delete(value);
  return result as T;
}

/**
 * Validates a component-local candidate comparison and returns a frozen,
 * hashed artifact. Candidate order is preserved exactly as supplied and carries
 * no meaning. The function never derives a decision, ranking, score, or
 * selection from the candidates.
 */
export function createCandidateComparisonArtifact<
  C extends MathematicalComponent,
>(input: CandidateComparisonArtifactInput<C>): CandidateComparisonArtifact<C> {
  const content = snapshotData(input, 'artifact');
  const record = assertRecord(content, 'artifact');
  assertKnownFields(record, ARTIFACT_FIELDS, 'artifact');
  assertNonEmptyString(record.artifactId, 'artifact.artifactId');
  assertNonEmptyString(record.artifactVersion, 'artifact.artifactVersion');
  const component = assertOneOf(
    record.component,
    MATHEMATICAL_COMPONENTS,
    'INVALID_COMPONENT',
    'artifact.component',
  );
  validateGovernedDecisionReference(
    record.governedDecisionReference,
    component,
    'artifact.governedDecisionReference',
  );
  assertNonEmptyString(
    record.currentFormulationSummary,
    'artifact.currentFormulationSummary',
  );
  if (!Array.isArray(record.candidates) || record.candidates.length === 0) {
    fail(
      'INVALID_SHAPE',
      'artifact.candidates must contain at least one candidate.',
    );
  }
  const ids = new Set<string>();
  record.candidates.forEach((candidate, index) => {
    validateCandidate(candidate, component, `artifact.candidates[${index}]`);
    const id = (candidate as CandidateFormulationRecord).candidateId;
    if (ids.has(id))
      fail(
        'DUPLICATE_CANDIDATE_ID',
        `Candidate id ${id} is duplicated within component ${component}.`,
      );
    ids.add(id);
  });

  const artifact: CandidateComparisonArtifact<C> = {
    ...content,
    scope: 'READ_ONLY_ANALYTICAL',
    artifactHash: hashCanonical(content),
  };
  return deepFreeze(artifact);
}
