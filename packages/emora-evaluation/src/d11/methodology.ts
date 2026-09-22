import { hashCanonical } from '../canonicalize';
import {
  D09_ACTIVE_METRICS,
  D09_PROPOSABLE_DIMENSIONS,
  D09_SCALE_DIRECTIONS,
  D09_SCALE_TYPES,
} from '../d09/contracts';
import {
  D11_ABLATION_OPERATIONS,
  D11_BASELINE_KINDS,
  D11_CONTRACT_VERSION,
  D11_DERIVATION_DATA_DECLARATIONS,
  D11_DERIVATION_USES,
  D11_METHODOLOGY_VERSION,
  D11_PROHIBITED_SEMANTICS,
} from './contracts';
import type {
  D11AuthorityReferenceRequirement,
  D11BaselineAuthorityArtifact,
  D11BaselineAuthorityInput,
  D11BaselineDefinitionArtifact,
  D11BaselineDefinitionInput,
  D11BaselineRunIdentityArtifact,
  D11BaselineRunIdentityInput,
  D11BaselineScope,
  D11CandidateRunIdentityArtifact,
  D11CandidateRunIdentityInput,
  D11ComparisonArtifact,
  D11ComparisonInput,
  D11ComparisonReason,
  D11ComparisonStatus,
  D11DataProvenance,
  D11IdentityReference,
  D11MetricEvidence,
  D11ScopedValue,
} from './contracts';

export type D11Violation =
  | 'INVALID_SHAPE'
  | 'UNKNOWN_FIELD'
  | 'INVALID_IDENTIFIER'
  | 'INVALID_VERSION'
  | 'INVALID_HASH'
  | 'INVALID_TIMESTAMP'
  | 'UNSUPPORTED_BASELINE_KIND'
  | 'UNSUPPORTED_ABLATION'
  | 'INVALID_CONSTANT_CONFIGURATION'
  | 'INVALID_SCOPE'
  | 'INVALID_PROVENANCE'
  | 'INVALID_PREDEFINITION_EVIDENCE'
  | 'INVALID_INDEPENDENCE_EVIDENCE'
  | 'INVALID_AUTHORITY'
  | 'INVALID_RUN_IDENTITY'
  | 'INVALID_METRIC_EVIDENCE'
  | 'BASELINE_DEFINITION_HASH_MISMATCH'
  | 'AUTHORITY_HASH_MISMATCH'
  | 'RUN_IDENTITY_HASH_MISMATCH'
  | 'COMPARISON_HASH_MISMATCH'
  | 'PROHIBITED_SEMANTICS';

export class D11ValidationError extends Error {
  readonly violation: D11Violation;

  constructor(violation: D11Violation, message: string) {
    super(message);
    this.name = 'D11ValidationError';
    this.violation = violation;
  }
}

const SHA256 = /^[0-9a-f]{64}$/;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]*$/;
const VERSION = /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,2}(?:-[A-Za-z0-9.-]+)?$/;
const CANONICAL_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PROHIBITED_SEMANTIC_CONTENT =
  /\b(?:ground[ _-]?truth|psychological[ _-]?truth|emotional[ _-]?truth|validity[ _-]?criterion|threshold|threshold[ _-]?derived[ _-]?baseline|baseline[ _-]?derived[ _-]?threshold|winner|ranking|ranked|rank|superiority|improvement|best[ _-]?model|model[ _-]?selection|baseline[ _-]?selection|selection[ _-]?criterion|pass[ _-]?fail|success[ _-]?criterion|failure[ _-]?criterion|composite[ _-]?score|aggregate[ _-]?score|recommendation)\b/i;
const PROHIBITED_SEMANTIC_KEY =
  /winner|ranking|ranked|superior|threshold|score|recommend|pass|fail|improve|select|composite|success|failure/i;

/**
 * The frozen methodology requires an independently issued governance decision
 * for a baseline to be comparable. D11 can require, bind, and record that
 * decision; it cannot adjudicate it. This constant therefore carries no
 * authority: it is not an authority artifact, it authorizes nothing, and no
 * caller input can turn it into authority. It is enforced by canonical content
 * equality, so a caller-authored look-alike is rejected rather than accepted as
 * the requirement.
 */
export const D11_AUTHORITY_REFERENCE_REQUIREMENT: D11AuthorityReferenceRequirement =
  Object.freeze({
    requirementId: 'd11-authority-requirement',
    requirementVersion: '1.0.0',
    requirementKind: 'REQUIRES_SEPARATELY_ISSUED_GOVERNANCE_DECISION',
    bindingRule: 'EXACT_BASELINE_DEFINITION_HASH',
    verifiedByD11: false,
    adjudicatesExternalAuthority: false,
    notes:
      'Authority is issued outside this implementation. D11 binds it to the exact canonical baseline definition hash and does not verify the issuer, standing, or chronology of the decision.',
  });

function fail(violation: D11Violation, message: string): never {
  throw new D11ValidationError(violation, message);
}

function snapshot<T>(
  value: T,
  path: string,
  active = new WeakSet<object>(),
): T {
  if (typeof value !== 'object' || value === null) return value;
  if (active.has(value)) fail('INVALID_SHAPE', `${path} must not be circular.`);
  active.add(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype)
      fail('INVALID_SHAPE', `${path} must be a plain array.`);
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
        fail(
          'INVALID_SHAPE',
          `${path}[${index}] must be an enumerable data property.`,
        );
      result.push(snapshot(descriptor.value, `${path}[${index}]`, active));
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol')
        fail('INVALID_SHAPE', `${path} must not contain symbol properties.`);
      if (key === 'length') continue;
      const index = Number(key);
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= value.length ||
        String(index) !== key
      )
        fail('INVALID_SHAPE', `${path}.${key} is not an array index.`);
    }
    active.delete(value);
    return result as T;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    fail('INVALID_SHAPE', `${path} must be a plain data object.`);
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol')
      fail('INVALID_SHAPE', `${path} must not contain symbol properties.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
      fail(
        'INVALID_SHAPE',
        `${path}.${key} must be an enumerable data property.`,
      );
    if (descriptor.value === undefined)
      fail('INVALID_SHAPE', `${path}.${key} must not be explicitly undefined.`);
    result[key] = snapshot(descriptor.value, `${path}.${key}`, active);
  }
  active.delete(value);
  return result as T;
}

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    // Always descend: an already frozen value may still not have been frozen
    // deeply by its producer, so freezing cannot be skipped on that basis.
    for (const nested of Object.values(value as Record<string, unknown>))
      freeze(nested);
    Object.freeze(value);
  }
  return value;
}

function requireGovernedRequirement(value: unknown, path: string): void {
  // The requirement is a normative statement of what the frozen methodology
  // requires from governance. It is enforced by canonical content equality, so
  // any caller-authored variation (including a look-alike that differs only in
  // its notes) is rejected rather than stored as if it were the requirement.
  if (
    hashCanonical(value) !== hashCanonical(D11_AUTHORITY_REFERENCE_REQUIREMENT)
  )
    fail(
      'INVALID_AUTHORITY',
      `${path} must be the governed D11 authority requirement.`,
    );
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail('INVALID_SHAPE', `${path} must be an object.`);
  return value as Record<string, unknown>;
}

function knownFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) {
      if (PROHIBITED_SEMANTIC_KEY.test(key))
        fail('PROHIBITED_SEMANTICS', `${path}.${key} is prohibited by D11.`);
      fail('UNKNOWN_FIELD', `${path}.${key} is not recognised.`);
    }
  }
}

function text(
  value: unknown,
  path: string,
  allowSemanticWords = false,
): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    fail('INVALID_SHAPE', `${path} must be a non-empty string.`);
  if (!allowSemanticWords && PROHIBITED_SEMANTIC_CONTENT.test(value))
    fail(
      'PROHIBITED_SEMANTICS',
      `${path} must not encode prohibited D11 semantics.`,
    );
  return value;
}

function identifier(value: unknown, path: string): string {
  const result = text(value, path);
  if (!IDENTIFIER.test(result))
    fail('INVALID_IDENTIFIER', `${path} must be an opaque identifier.`);
  return result;
}

function version(value: unknown, path: string): string {
  const result = text(value, path);
  if (!VERSION.test(result))
    fail('INVALID_VERSION', `${path} must be a version identifier.`);
  return result;
}

function sha(value: unknown, path: string): string {
  if (typeof value !== 'string' || !SHA256.test(value))
    fail('INVALID_HASH', `${path} must be SHA-256.`);
  return value;
}

function timestamp(value: unknown, path: string): string {
  const result = text(value, path, true);
  const parsed = Date.parse(result);
  if (
    !CANONICAL_ISO_TIMESTAMP.test(result) ||
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== result
  )
    fail(
      'INVALID_TIMESTAMP',
      `${path} must be a canonical UTC ISO-8601 timestamp.`,
    );
  return result;
}

function oneOf<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T))
    fail('INVALID_SHAPE', `${path} has an invalid value.`);
  return value as T;
}

function validateIdentity(value: unknown, path: string): D11IdentityReference {
  const identity = record(value, path);
  knownFields(identity, ['id', 'version', 'hash'], path);
  identifier(identity.id, `${path}.id`);
  version(identity.version, `${path}.version`);
  sha(identity.hash, `${path}.hash`);
  return identity as unknown as D11IdentityReference;
}

function validateScopedValue<T>(
  value: unknown,
  path: string,
  validateValue: (nested: unknown, nestedPath: string) => T,
): D11ScopedValue<T> {
  const scoped = record(value, path);
  if (scoped.applicability === 'APPLICABLE') {
    knownFields(scoped, ['applicability', 'value'], path);
    validateValue(scoped.value, `${path}.value`);
  } else if (scoped.applicability === 'NOT_APPLICABLE') {
    knownFields(scoped, ['applicability', 'reason'], path);
    text(scoped.reason, `${path}.reason`);
  } else fail('INVALID_SCOPE', `${path}.applicability is invalid.`);
  return scoped as unknown as D11ScopedValue<T>;
}

function validateScope(value: unknown, path: string): D11BaselineScope {
  const scope = record(value, path);
  knownFields(
    scope,
    [
      'datasetIdentity',
      'orderedCaseIds',
      'evaluationContractIdentity',
      'metric',
      'targetOutput',
      'dimension',
      'construct',
      'scale',
      'observationUnit',
      'context',
      'modelIdentity',
      'parameterConfigurationIdentity',
    ],
    path,
  );
  validateScopedValue(
    scope.datasetIdentity,
    `${path}.datasetIdentity`,
    (nested, nestedPath) => {
      validateDatasetIdentity(nested, nestedPath);
      return nested as never;
    },
  );
  validateScopedValue(
    scope.orderedCaseIds,
    `${path}.orderedCaseIds`,
    (nested, nestedPath) => {
      validateOrderedCaseIds(nested, nestedPath);
      return nested as never;
    },
  );
  validateScopedValue(
    scope.evaluationContractIdentity,
    `${path}.evaluationContractIdentity`,
    (nested, nestedPath) => {
      validateEvaluationContractIdentity(nested, nestedPath);
      return nested as never;
    },
  );
  oneOf(scope.metric, D09_ACTIVE_METRICS, `${path}.metric`);
  text(scope.targetOutput, `${path}.targetOutput`);
  oneOf(scope.dimension, D09_PROPOSABLE_DIMENSIONS, `${path}.dimension`);
  validateScopedValue(
    scope.construct,
    `${path}.construct`,
    (nested, nestedPath) => text(nested, nestedPath),
  );
  const scale = record(scope.scale, `${path}.scale`);
  knownFields(scale, ['type', 'units', 'direction'], `${path}.scale`);
  oneOf(scale.type, D09_SCALE_TYPES, `${path}.scale.type`);
  text(scale.units, `${path}.scale.units`);
  oneOf(scale.direction, D09_SCALE_DIRECTIONS, `${path}.scale.direction`);
  text(scope.observationUnit, `${path}.observationUnit`);
  text(scope.context, `${path}.context`);
  validateScopedValue(
    scope.modelIdentity,
    `${path}.modelIdentity`,
    validateIdentity,
  );
  validateScopedValue(
    scope.parameterConfigurationIdentity,
    `${path}.parameterConfigurationIdentity`,
    validateIdentity,
  );
  return scope as unknown as D11BaselineScope;
}

function validateDataProvenance(
  value: unknown,
  path: string,
): D11DataProvenance {
  const data = record(value, path);
  knownFields(
    data,
    [
      'role',
      'identity',
      'derivationUse',
      'overlapsEvaluationData',
      'independenceEvidenceReference',
      'removesReference',
    ],
    path,
  );
  oneOf(
    data.role,
    ['DEVELOPMENT_TUNING', 'HELD_OUT', 'EXTERNAL_REFERENCE'] as const,
    `${path}.role`,
  );
  validateIdentity(data.identity, `${path}.identity`);
  oneOf(data.derivationUse, D11_DERIVATION_USES, `${path}.derivationUse`);
  if (
    data.overlapsEvaluationData !== true &&
    data.overlapsEvaluationData !== false &&
    data.overlapsEvaluationData !== 'UNKNOWN'
  )
    fail(
      'INVALID_PROVENANCE',
      `${path}.overlapsEvaluationData must be explicit.`,
    );
  text(
    data.independenceEvidenceReference,
    `${path}.independenceEvidenceReference`,
  );
  if (typeof data.removesReference !== 'string')
    fail(
      'INVALID_PROVENANCE',
      `${path}.removesReference must be explicitly declared.`,
    );
  text(data.removesReference, `${path}.removesReference`);
  return data as unknown as D11DataProvenance;
}

function validateDatasetIdentity(value: unknown, path: string): void {
  const dataset = record(value, path);
  knownFields(dataset, ['datasetId', 'datasetVersion', 'datasetHash'], path);
  identifier(dataset.datasetId, `${path}.datasetId`);
  version(dataset.datasetVersion, `${path}.datasetVersion`);
  sha(dataset.datasetHash, `${path}.datasetHash`);
}

function validateEvaluationContractIdentity(
  value: unknown,
  path: string,
): void {
  const contract = record(value, path);
  knownFields(contract, ['contractVersion', 'contractHash'], path);
  version(contract.contractVersion, `${path}.contractVersion`);
  sha(contract.contractHash, `${path}.contractHash`);
}

function validateOrderedCaseIds(value: unknown, path: string): void {
  if (!Array.isArray(value) || value.length === 0)
    fail('INVALID_RUN_IDENTITY', `${path} must be a non-empty array.`);
  value.forEach((caseId, index) => identifier(caseId, `${path}[${index}]`));
  if (new Set(value).size !== value.length)
    fail('INVALID_RUN_IDENTITY', `${path} must contain unique identifiers.`);
}

function validateDefinitionInput(
  value: unknown,
  path: string,
): D11BaselineDefinitionInput {
  const definition = record(value, path);
  knownFields(
    definition,
    [
      'baselineId',
      'baselineVersion',
      'kind',
      'configuration',
      'scope',
      'provenance',
      'justification',
      'predefinition',
      'independence',
    ],
    path,
  );
  identifier(definition.baselineId, `${path}.baselineId`);
  version(definition.baselineVersion, `${path}.baselineVersion`);
  if (
    typeof definition.kind !== 'string' ||
    !D11_BASELINE_KINDS.includes(definition.kind as never)
  )
    fail('UNSUPPORTED_BASELINE_KIND', `${path}.kind is not authorized.`);
  const kind = definition.kind as D11BaselineDefinitionInput['kind'];
  const configuration = record(
    definition.configuration,
    `${path}.configuration`,
  );
  if (configuration.kind !== kind)
    fail(
      'INVALID_SHAPE',
      `${path}.configuration.kind must match baseline kind.`,
    );
  if (kind === 'CONSTANT') {
    knownFields(
      configuration,
      ['kind', 'targetValues'],
      `${path}.configuration`,
    );
    const targetValues = record(
      configuration.targetValues,
      `${path}.configuration.targetValues`,
    );
    if (Object.keys(targetValues).length === 0)
      fail(
        'INVALID_CONSTANT_CONFIGURATION',
        'A constant baseline requires explicit target values.',
      );
    for (const [key, targetValue] of Object.entries(targetValues)) {
      identifier(key, `${path}.configuration.targetValues key`);
      if (
        typeof targetValue !== 'number' ||
        !Number.isFinite(targetValue) ||
        Object.is(targetValue, -0)
      )
        fail(
          'INVALID_CONSTANT_CONFIGURATION',
          `${path}.configuration.targetValues.${key} must be finite and not negative zero.`,
        );
    }
  } else if (kind === 'DETERMINISTIC_ABLATION') {
    knownFields(
      configuration,
      [
        'kind',
        'operation',
        'lineage',
        'preservedConfigurationHash',
        'mechanismReference',
      ],
      `${path}.configuration`,
    );
    if (!D11_ABLATION_OPERATIONS.includes(configuration.operation as never))
      fail(
        'UNSUPPORTED_ABLATION',
        `${path}.configuration.operation is not authorized.`,
      );
    const lineage = record(
      configuration.lineage,
      `${path}.configuration.lineage`,
    );
    knownFields(
      lineage,
      ['modelIdentity', 'parameterConfigurationIdentity'],
      `${path}.configuration.lineage`,
    );
    validateIdentity(
      lineage.modelIdentity,
      `${path}.configuration.lineage.modelIdentity`,
    );
    validateIdentity(
      lineage.parameterConfigurationIdentity,
      `${path}.configuration.lineage.parameterConfigurationIdentity`,
    );
    sha(
      configuration.preservedConfigurationHash,
      `${path}.configuration.preservedConfigurationHash`,
    );
    text(
      configuration.mechanismReference,
      `${path}.configuration.mechanismReference`,
    );
  } else fail('UNSUPPORTED_BASELINE_KIND', `${path}.kind is not authorized.`);

  validateScope(definition.scope, `${path}.scope`);
  if (
    kind === 'CONSTANT' &&
    !(
      (definition.scope as D11BaselineScope).dimension in
      (configuration.targetValues as Record<string, unknown>)
    )
  )
    fail(
      'INVALID_CONSTANT_CONFIGURATION',
      'A constant baseline must define its governed target dimension.',
    );
  const provenance = record(definition.provenance, `${path}.provenance`);
  knownFields(
    provenance,
    [
      'sourceReference',
      'justificationReference',
      'derivationDataAbsence',
      'basisReference',
      'dataSources',
    ],
    `${path}.provenance`,
  );
  text(provenance.sourceReference, `${path}.provenance.sourceReference`);
  text(
    provenance.justificationReference,
    `${path}.provenance.justificationReference`,
  );
  const derivationDeclaration = oneOf(
    provenance.derivationDataAbsence,
    D11_DERIVATION_DATA_DECLARATIONS,
    `${path}.provenance.derivationDataAbsence`,
  );
  if (!Array.isArray(provenance.dataSources))
    fail(
      'INVALID_PROVENANCE',
      `${path}.provenance.dataSources must be an array.`,
    );
  provenance.dataSources.forEach((item, index) =>
    validateDataProvenance(item, `${path}.provenance.dataSources[${index}]`),
  );
  if (
    derivationDeclaration === 'DECLARED_DERIVATION_DATA' &&
    provenance.dataSources.length === 0
  )
    fail(
      'INVALID_PROVENANCE',
      'Declared derivation data requires at least one declared data source.',
    );
  if (derivationDeclaration === 'DECLARED_NO_DERIVATION_DATA') {
    text(provenance.basisReference, `${path}.provenance.basisReference`);
    if (provenance.dataSources.length > 0)
      fail(
        'INVALID_PROVENANCE',
        'Declared absence of derivation data must not declare data sources.',
      );
  } else if ('basisReference' in provenance)
    fail(
      'INVALID_PROVENANCE',
      `${path}.provenance.basisReference is only valid for a declared absence of derivation data.`,
    );
  text(definition.justification, `${path}.justification`);

  const predefinition = record(
    definition.predefinition,
    `${path}.predefinition`,
  );
  knownFields(
    predefinition,
    [
      'status',
      'evidenceReference',
      'freezeId',
      'freezeVersion',
      'declaredFrozenAt',
      'externalChronologyVerification',
    ],
    `${path}.predefinition`,
  );
  oneOf(
    predefinition.status,
    ['ESTABLISHED', 'INSUFFICIENT'] as const,
    `${path}.predefinition.status`,
  );
  text(
    predefinition.evidenceReference,
    `${path}.predefinition.evidenceReference`,
  );
  identifier(predefinition.freezeId, `${path}.predefinition.freezeId`);
  version(predefinition.freezeVersion, `${path}.predefinition.freezeVersion`);
  timestamp(
    predefinition.declaredFrozenAt,
    `${path}.predefinition.declaredFrozenAt`,
  );
  oneOf(
    predefinition.externalChronologyVerification,
    [
      'DOCUMENTED_EXTERNAL_EVIDENCE',
      'NOT_VERIFIED_NO_EXTERNAL_TIMELINE_AUTHORITY',
    ] as const,
    `${path}.predefinition.externalChronologyVerification`,
  );
  if (
    predefinition.status === 'ESTABLISHED' &&
    predefinition.externalChronologyVerification !==
      'DOCUMENTED_EXTERNAL_EVIDENCE'
  )
    fail(
      'INVALID_PREDEFINITION_EVIDENCE',
      'Established predefinition requires documented external evidence.',
    );

  const independence = record(definition.independence, `${path}.independence`);
  knownFields(
    independence,
    [
      'status',
      'fittedOnEvaluationResults',
      'tunedOnEvaluationResults',
      'optimizedOnEvaluationResults',
      'selectedUsingEvaluationResults',
      'postResultDecision',
      'reusedEvaluationResults',
      'evaluationDataOverlap',
      'evidenceReference',
    ],
    `${path}.independence`,
  );
  oneOf(
    independence.status,
    ['ESTABLISHED', 'INSUFFICIENT'] as const,
    `${path}.independence.status`,
  );
  for (const field of [
    'fittedOnEvaluationResults',
    'tunedOnEvaluationResults',
    'optimizedOnEvaluationResults',
    'selectedUsingEvaluationResults',
    'postResultDecision',
    'reusedEvaluationResults',
  ])
    if (independence[field] !== false)
      fail(
        'INVALID_INDEPENDENCE_EVIDENCE',
        `${path}.independence.${field} must be false.`,
      );
  if (
    independence.evaluationDataOverlap !== false &&
    independence.evaluationDataOverlap !== 'UNKNOWN'
  )
    fail(
      'INVALID_INDEPENDENCE_EVIDENCE',
      `${path}.independence.evaluationDataOverlap is invalid.`,
    );
  text(
    independence.evidenceReference,
    `${path}.independence.evidenceReference`,
  );
  return definition as unknown as D11BaselineDefinitionInput;
}

export function createD11BaselineDefinition(
  input: D11BaselineDefinitionInput,
): D11BaselineDefinitionArtifact {
  const definition = snapshot(input, 'baselineDefinition');
  validateDefinitionInput(definition, 'baselineDefinition');
  const content = {
    ...definition,
    contractVersion: D11_CONTRACT_VERSION,
    methodologyVersion: D11_METHODOLOGY_VERSION,
    semantics: 'PREDEFINED_CONTEXTUAL_REFERENCE_ONLY' as const,
    automaticAuthority: false as const,
    prohibitedSemantics: [...D11_PROHIBITED_SEMANTICS],
    configurationHash: hashCanonical(definition.configuration),
    scopeHash: hashCanonical(definition.scope),
  };
  return freeze({ ...content, baselineDefinitionHash: hashCanonical(content) });
}

function verifyDefinition(
  value: D11BaselineDefinitionArtifact,
): D11BaselineDefinitionArtifact {
  const artifact = snapshot(value, 'baselineDefinitionArtifact');
  const root = record(artifact, 'baselineDefinitionArtifact');
  knownFields(
    root,
    [
      'baselineId',
      'baselineVersion',
      'kind',
      'configuration',
      'scope',
      'provenance',
      'justification',
      'predefinition',
      'independence',
      'contractVersion',
      'methodologyVersion',
      'semantics',
      'automaticAuthority',
      'prohibitedSemantics',
      'configurationHash',
      'scopeHash',
      'baselineDefinitionHash',
    ],
    'baselineDefinitionArtifact',
  );
  if (
    artifact.contractVersion !== D11_CONTRACT_VERSION ||
    artifact.methodologyVersion !== D11_METHODOLOGY_VERSION ||
    artifact.semantics !== 'PREDEFINED_CONTEXTUAL_REFERENCE_ONLY' ||
    artifact.automaticAuthority !== false
  )
    fail(
      'BASELINE_DEFINITION_HASH_MISMATCH',
      'D11 definition-owned metadata is invalid.',
    );
  if (
    JSON.stringify(artifact.prohibitedSemantics) !==
    JSON.stringify(D11_PROHIBITED_SEMANTICS)
  )
    fail(
      'BASELINE_DEFINITION_HASH_MISMATCH',
      'D11 prohibited semantics are invalid.',
    );
  const input = {
    baselineId: artifact.baselineId,
    baselineVersion: artifact.baselineVersion,
    kind: artifact.kind,
    configuration: artifact.configuration,
    scope: artifact.scope,
    provenance: artifact.provenance,
    justification: artifact.justification,
    predefinition: artifact.predefinition,
    independence: artifact.independence,
  };
  const expected = createD11BaselineDefinition(input);
  if (
    artifact.configurationHash !== expected.configurationHash ||
    artifact.scopeHash !== expected.scopeHash ||
    artifact.baselineDefinitionHash !== expected.baselineDefinitionHash
  )
    fail(
      'BASELINE_DEFINITION_HASH_MISMATCH',
      'Baseline definition hashes do not match canonical content.',
    );
  return expected;
}

export function createD11BaselineAuthority(
  definition: D11BaselineDefinitionArtifact,
  input: D11BaselineAuthorityInput,
): D11BaselineAuthorityArtifact {
  const governedDefinition = verifyDefinition(definition);
  const authority = snapshot(input, 'baselineAuthority');
  const root = record(authority, 'baselineAuthority');
  knownFields(
    root,
    [
      'authorityId',
      'authorityVersion',
      'decision',
      'approvedDefinitionHash',
      'approvalEvidenceReference',
      'approvedAt',
      'authorityRequirement',
    ],
    'baselineAuthority',
  );
  identifier(authority.authorityId, 'baselineAuthority.authorityId');
  version(authority.authorityVersion, 'baselineAuthority.authorityVersion');
  if (authority.decision !== 'APPROVED_D11_BASELINE_DEFINITION')
    fail('INVALID_AUTHORITY', 'Authority decision is invalid.');
  sha(
    authority.approvedDefinitionHash,
    'baselineAuthority.approvedDefinitionHash',
  );
  if (
    authority.approvedDefinitionHash !==
    governedDefinition.baselineDefinitionHash
  )
    fail(
      'INVALID_AUTHORITY',
      'Authority must reference the exact governed definition hash.',
    );
  text(
    authority.approvalEvidenceReference,
    'baselineAuthority.approvalEvidenceReference',
  );
  timestamp(authority.approvedAt, 'baselineAuthority.approvedAt');
  // The authority requirement is a normative statement of what the frozen
  // methodology requires from governance. It is enforced by canonical content
  // equality, so a caller-authored object that merely describes authority cannot
  // satisfy it and cannot be stored in an authority artifact.
  requireGovernedRequirement(
    authority.authorityRequirement,
    'baselineAuthority.authorityRequirement',
  );
  const content = {
    authorityId: authority.authorityId,
    authorityVersion: authority.authorityVersion,
    decision: authority.decision,
    approvedDefinitionHash: authority.approvedDefinitionHash,
    approvalEvidenceReference: authority.approvalEvidenceReference,
    approvedAt: authority.approvedAt,
    authorityRequirement: D11_AUTHORITY_REFERENCE_REQUIREMENT,
    contractVersion: D11_CONTRACT_VERSION,
    methodologyVersion: D11_METHODOLOGY_VERSION,
    authorityKind: 'VERSIONED_DECLARED_GOVERNANCE_ARTIFACT' as const,
    authorityOrigin: 'SEPARATELY_ISSUED_GOVERNANCE_ARTIFACT' as const,
    callerDeclarationAloneIsAuthority: false as const,
    externalAuthorityVerification:
      'NOT_VERIFIED_NO_EXTERNAL_AUTHORITY_ADJUDICATION' as const,
  };
  return freeze({ ...content, authorityHash: hashCanonical(content) });
}

function verifyAuthority(
  value: D11BaselineAuthorityArtifact,
  definition: D11BaselineDefinitionArtifact,
): D11BaselineAuthorityArtifact {
  const artifact = snapshot(value, 'baselineAuthorityArtifact');
  const root = record(artifact, 'baselineAuthorityArtifact');
  knownFields(
    root,
    [
      'authorityId',
      'authorityVersion',
      'decision',
      'approvedDefinitionHash',
      'approvalEvidenceReference',
      'approvedAt',
      'authorityRequirement',
      'contractVersion',
      'methodologyVersion',
      'authorityKind',
      'authorityOrigin',
      'callerDeclarationAloneIsAuthority',
      'externalAuthorityVerification',
      'authorityHash',
    ],
    'baselineAuthorityArtifact',
  );
  identifier(artifact.authorityId, 'baselineAuthorityArtifact.authorityId');
  version(
    artifact.authorityVersion,
    'baselineAuthorityArtifact.authorityVersion',
  );
  if (artifact.decision !== 'APPROVED_D11_BASELINE_DEFINITION')
    fail('INVALID_AUTHORITY', 'Authority decision is invalid.');
  sha(
    artifact.approvedDefinitionHash,
    'baselineAuthorityArtifact.approvedDefinitionHash',
  );
  text(
    artifact.approvalEvidenceReference,
    'baselineAuthorityArtifact.approvalEvidenceReference',
  );
  timestamp(artifact.approvedAt, 'baselineAuthorityArtifact.approvedAt');
  sha(artifact.authorityHash, 'baselineAuthorityArtifact.authorityHash');
  // Artifacts carry a snapshot copy of the requirement, so it is compared by
  // canonical content here; the object-identity guard applies to direct
  // construction in createD11BaselineAuthority.
  if (
    hashCanonical(artifact.authorityRequirement) !==
    hashCanonical(D11_AUTHORITY_REFERENCE_REQUIREMENT)
  )
    fail(
      'INVALID_AUTHORITY',
      'Authority requirement must be the governed D11 requirement.',
    );
  const content = { ...artifact } as Record<string, unknown>;
  delete content.authorityHash;
  if (
    artifact.contractVersion !== D11_CONTRACT_VERSION ||
    artifact.methodologyVersion !== D11_METHODOLOGY_VERSION ||
    artifact.authorityKind !== 'VERSIONED_DECLARED_GOVERNANCE_ARTIFACT' ||
    artifact.authorityOrigin !== 'SEPARATELY_ISSUED_GOVERNANCE_ARTIFACT' ||
    artifact.callerDeclarationAloneIsAuthority !== false ||
    artifact.externalAuthorityVerification !==
      'NOT_VERIFIED_NO_EXTERNAL_AUTHORITY_ADJUDICATION' ||
    hashCanonical(content) !== artifact.authorityHash
  )
    fail(
      'AUTHORITY_HASH_MISMATCH',
      'Authority artifact does not match canonical content.',
    );
  const expected = createD11BaselineAuthority(definition, {
    authorityId: artifact.authorityId,
    authorityVersion: artifact.authorityVersion,
    decision: artifact.decision,
    approvedDefinitionHash: artifact.approvedDefinitionHash,
    approvalEvidenceReference: artifact.approvalEvidenceReference,
    approvedAt: artifact.approvedAt,
    authorityRequirement: D11_AUTHORITY_REFERENCE_REQUIREMENT,
  });
  if (expected.authorityHash !== artifact.authorityHash)
    fail(
      'AUTHORITY_HASH_MISMATCH',
      'Authority artifact is not bound to the exact governed definition.',
    );
  return expected;
}

export function computeD11MetricEvidenceHash(
  evidence: Omit<D11MetricEvidence, 'resultHash'>,
): string {
  return hashCanonical(evidence);
}

function validateMetricEvidence(
  value: unknown,
  path: string,
): D11MetricEvidence {
  const evidence = record(value, path);
  knownFields(
    evidence,
    ['metric', 'dimension', 'status', 'value', 'resultHash'],
    path,
  );
  oneOf(evidence.metric, D09_ACTIVE_METRICS, `${path}.metric`);
  oneOf(evidence.dimension, D09_PROPOSABLE_DIMENSIONS, `${path}.dimension`);
  const status = oneOf(
    evidence.status,
    ['COMPUTED', 'INVALID', 'INSUFFICIENT_DATA', 'UNDEFINED'] as const,
    `${path}.status`,
  );
  if (status === 'COMPUTED') {
    if (
      typeof evidence.value !== 'number' ||
      !Number.isFinite(evidence.value) ||
      Object.is(evidence.value, -0)
    )
      fail(
        'INVALID_METRIC_EVIDENCE',
        `${path}.value must be finite and not negative zero.`,
      );
  } else if ('value' in evidence)
    fail(
      'INVALID_METRIC_EVIDENCE',
      `${path}.value must be absent when the metric is not computed.`,
    );
  sha(evidence.resultHash, `${path}.resultHash`);
  const content = { ...evidence };
  delete content.resultHash;
  if (hashCanonical(content) !== evidence.resultHash)
    fail(
      'INVALID_METRIC_EVIDENCE',
      `${path}.resultHash does not match canonical metric evidence.`,
    );
  return evidence as unknown as D11MetricEvidence;
}

function validateRunBase(
  value: Record<string, unknown>,
  path: string,
  role: 'CANDIDATE' | 'BASELINE',
): void {
  const fields = [
    'role',
    'runId',
    'effectiveConfigurationHash',
    'providerIdentity',
    'parameterIdentity',
    'toolchainIdentity',
    'datasetIdentity',
    'evaluationContractIdentity',
    'orderedCaseIds',
    'scope',
    'metricEvidence',
    'executionTimestamp',
  ];
  knownFields(
    value,
    role === 'BASELINE' ? [...fields, 'baselineDefinitionHash'] : fields,
    path,
  );
  if (value.role !== role)
    fail('INVALID_RUN_IDENTITY', `${path}.role is invalid.`);
  identifier(value.runId, `${path}.runId`);
  sha(value.effectiveConfigurationHash, `${path}.effectiveConfigurationHash`);
  validateIdentity(value.providerIdentity, `${path}.providerIdentity`);
  validateScopedValue(
    value.parameterIdentity,
    `${path}.parameterIdentity`,
    validateIdentity,
  );
  validateScopedValue(
    value.toolchainIdentity,
    `${path}.toolchainIdentity`,
    validateIdentity,
  );
  validateDatasetIdentity(value.datasetIdentity, `${path}.datasetIdentity`);
  validateEvaluationContractIdentity(
    value.evaluationContractIdentity,
    `${path}.evaluationContractIdentity`,
  );
  validateOrderedCaseIds(value.orderedCaseIds, `${path}.orderedCaseIds`);
  validateScope(value.scope, `${path}.scope`);
  if (!Array.isArray(value.metricEvidence) || value.metricEvidence.length === 0)
    fail('INVALID_RUN_IDENTITY', `${path}.metricEvidence must be non-empty.`);
  (value.metricEvidence as unknown[]).forEach((item, index) =>
    validateMetricEvidence(item, `${path}.metricEvidence[${index}]`),
  );
  timestamp(value.executionTimestamp, `${path}.executionTimestamp`);
  if (role === 'BASELINE')
    sha(value.baselineDefinitionHash, `${path}.baselineDefinitionHash`);
}

function createRun<
  T extends D11CandidateRunIdentityInput | D11BaselineRunIdentityInput,
>(input: T): T & { readonly runIdentityHash: string } {
  const run = snapshot(input, `${input.role.toLowerCase()}Run`);
  validateRunBase(
    record(run, `${input.role.toLowerCase()}Run`),
    `${input.role.toLowerCase()}Run`,
    input.role,
  );
  return freeze({ ...run, runIdentityHash: hashCanonical(run) });
}

export function createD11CandidateRunIdentity(
  input: D11CandidateRunIdentityInput,
): D11CandidateRunIdentityArtifact {
  return createRun(input);
}

export function createD11BaselineRunIdentity(
  input: D11BaselineRunIdentityInput,
): D11BaselineRunIdentityArtifact {
  return createRun(input);
}

function verifyCandidateRun(
  value: D11CandidateRunIdentityArtifact,
): D11CandidateRunIdentityArtifact {
  const artifact = snapshot(value, 'candidateRunArtifact');
  const content = { ...artifact } as Record<string, unknown>;
  delete content.runIdentityHash;
  const expected = createD11CandidateRunIdentity(
    content as unknown as D11CandidateRunIdentityInput,
  );
  if (artifact.runIdentityHash !== expected.runIdentityHash)
    fail(
      'RUN_IDENTITY_HASH_MISMATCH',
      'Candidate run identity hash is stale or invalid.',
    );
  return expected;
}

function verifyBaselineRun(
  value: D11BaselineRunIdentityArtifact,
): D11BaselineRunIdentityArtifact {
  const artifact = snapshot(value, 'baselineRunArtifact');
  const content = { ...artifact } as Record<string, unknown>;
  delete content.runIdentityHash;
  const expected = createD11BaselineRunIdentity(
    content as unknown as D11BaselineRunIdentityInput,
  );
  if (artifact.runIdentityHash !== expected.runIdentityHash)
    fail(
      'RUN_IDENTITY_HASH_MISMATCH',
      'Baseline run identity hash is stale or invalid.',
    );
  return expected;
}

function equal(left: unknown, right: unknown): boolean {
  return hashCanonical(left) === hashCanonical(right);
}

function scopedEqual<T>(
  left: D11ScopedValue<T>,
  right: D11ScopedValue<T>,
): boolean {
  if (left.applicability !== right.applicability) return false;
  if (
    left.applicability === 'NOT_APPLICABLE' &&
    right.applicability === 'NOT_APPLICABLE'
  )
    return true;
  return (
    left.applicability === 'APPLICABLE' &&
    right.applicability === 'APPLICABLE' &&
    equal(left.value, right.value)
  );
}

function addScopeReasons(
  candidate: D11BaselineScope,
  baseline: D11BaselineScope,
  kind: D11BaselineDefinitionArtifact['kind'],
  reasons: D11ComparisonReason[],
): void {
  if (candidate.metric !== baseline.metric) reasons.push('METRIC_MISMATCH');
  if (candidate.targetOutput !== baseline.targetOutput)
    reasons.push('TARGET_OUTPUT_MISMATCH');
  if (candidate.dimension !== baseline.dimension)
    reasons.push('DIMENSION_MISMATCH');
  if (!scopedEqual(candidate.construct, baseline.construct))
    reasons.push('CONSTRUCT_MISMATCH');
  if (!equal(candidate.scale, baseline.scale)) reasons.push('SCALE_MISMATCH');
  if (candidate.observationUnit !== baseline.observationUnit)
    reasons.push('OBSERVATION_UNIT_MISMATCH');
  if (candidate.context !== baseline.context) reasons.push('CONTEXT_MISMATCH');
  if (
    kind === 'DETERMINISTIC_ABLATION' &&
    !scopedEqual(candidate.modelIdentity, baseline.modelIdentity)
  )
    reasons.push('MODEL_IDENTITY_MISMATCH');
  if (
    !scopedEqual(
      candidate.parameterConfigurationIdentity,
      baseline.parameterConfigurationIdentity,
    )
  )
    reasons.push('PARAMETER_CONFIGURATION_MISMATCH');
}

function definitionScopeMatchesRun(
  definition: D11BaselineDefinitionArtifact,
  run: D11BaselineRunIdentityArtifact,
): boolean {
  const scope = definition.scope;
  if (
    scope.datasetIdentity.applicability === 'APPLICABLE' &&
    !equal(scope.datasetIdentity.value, run.datasetIdentity)
  )
    return false;
  if (
    scope.orderedCaseIds.applicability === 'APPLICABLE' &&
    !equal(scope.orderedCaseIds.value, run.orderedCaseIds)
  )
    return false;
  if (
    scope.evaluationContractIdentity.applicability === 'APPLICABLE' &&
    !equal(
      scope.evaluationContractIdentity.value,
      run.evaluationContractIdentity,
    )
  )
    return false;
  const semanticReasons: D11ComparisonReason[] = [];
  addScopeReasons(scope, run.scope, definition.kind, semanticReasons);
  return semanticReasons.length === 0;
}

function governanceReasons(
  definition: D11BaselineDefinitionArtifact,
  authority: D11BaselineAuthorityArtifact | undefined,
): D11ComparisonReason[] {
  if (
    !authority ||
    authority.approvedDefinitionHash !== definition.baselineDefinitionHash ||
    authority.authorityRequirement !== D11_AUTHORITY_REFERENCE_REQUIREMENT
  )
    return ['UNAUTHORIZED_BASELINE'];
  if (
    !definition.provenance.sourceReference ||
    !definition.provenance.justificationReference
  )
    // Defensive guard: an insufficient provenance declaration cannot survive
    // definition construction, so this branch is unreachable for any artifact
    // produced by createD11BaselineDefinition.
    return ['INSUFFICIENT_PROVENANCE'];
  if (definition.predefinition.status !== 'ESTABLISHED')
    return ['PREDEFINITION_NOT_ESTABLISHED'];
  // An empty data-source list is never evidence of independence: the absence of
  // derivation data must be declared explicitly, and every declared source must
  // state its derivation use, overlap status, and independence evidence.
  if (
    definition.independence.status !== 'ESTABLISHED' ||
    definition.independence.evaluationDataOverlap === 'UNKNOWN' ||
    definition.provenance.dataSources.some(
      (source) => source.overlapsEvaluationData === 'UNKNOWN',
    )
  )
    return ['INDEPENDENCE_NOT_ESTABLISHED'];
  if (
    definition.provenance.dataSources.some(
      (source) => source.overlapsEvaluationData === true,
    )
  )
    return ['EVALUATION_DATA_LEAKAGE'];
  return [];
}

export function compareD11EvaluationRuns(
  input: D11ComparisonInput,
): D11ComparisonArtifact {
  const comparison = snapshot(input, 'comparison');
  const root = record(comparison, 'comparison');
  knownFields(
    root,
    [
      'comparatorId',
      'comparatorVersion',
      'candidateRun',
      'baselineDefinition',
      'baselineAuthority',
      'baselineRun',
    ],
    'comparison',
  );
  identifier(comparison.comparatorId, 'comparison.comparatorId');
  version(comparison.comparatorVersion, 'comparison.comparatorVersion');
  const definition = verifyDefinition(comparison.baselineDefinition);
  const authority = comparison.baselineAuthority
    ? verifyAuthority(comparison.baselineAuthority, definition)
    : undefined;
  const candidateRun = verifyCandidateRun(comparison.candidateRun);
  const baselineRun = verifyBaselineRun(comparison.baselineRun);

  const reasons = governanceReasons(definition, authority);
  let status: D11ComparisonStatus =
    reasons.length > 0 ? 'NOT_EVALUABLE' : 'COMPARABLE';

  if (
    reasons.length === 0 &&
    baselineRun.baselineDefinitionHash !== definition.baselineDefinitionHash
  ) {
    reasons.push('BASELINE_DEFINITION_BINDING_MISMATCH');
    status = 'NOT_EVALUABLE';
  }
  if (reasons.length === 0) {
    const expectedConfigurationHash =
      definition.configuration.kind === 'CONSTANT'
        ? definition.configurationHash
        : definition.configuration.preservedConfigurationHash;
    if (baselineRun.effectiveConfigurationHash !== expectedConfigurationHash) {
      reasons.push('BASELINE_CONFIGURATION_MISMATCH');
      status = 'NOT_EVALUABLE';
    }
  }
  if (
    reasons.length === 0 &&
    definition.configuration.kind === 'DETERMINISTIC_ABLATION'
  ) {
    const lineage = definition.configuration.lineage;
    if (
      baselineRun.scope.modelIdentity.applicability !== 'APPLICABLE' ||
      baselineRun.scope.parameterConfigurationIdentity.applicability !==
        'APPLICABLE' ||
      !equal(baselineRun.scope.modelIdentity.value, lineage.modelIdentity) ||
      !equal(
        baselineRun.scope.parameterConfigurationIdentity.value,
        lineage.parameterConfigurationIdentity,
      )
    ) {
      reasons.push('ABLATION_LINEAGE_MISMATCH');
      status = 'NOT_EVALUABLE';
    }
  }

  if (reasons.length === 0) {
    const pairingReasons: D11ComparisonReason[] = [];
    if (!equal(candidateRun.datasetIdentity, baselineRun.datasetIdentity))
      pairingReasons.push('DATASET_IDENTITY_MISMATCH');
    if (!equal(candidateRun.orderedCaseIds, baselineRun.orderedCaseIds))
      pairingReasons.push('CASE_ORDER_MISMATCH');
    if (
      !equal(
        candidateRun.evaluationContractIdentity,
        baselineRun.evaluationContractIdentity,
      )
    )
      pairingReasons.push('EVALUATION_CONTRACT_MISMATCH');
    addScopeReasons(
      candidateRun.scope,
      baselineRun.scope,
      definition.kind,
      pairingReasons,
    );
    if (pairingReasons.length > 0) {
      reasons.push(...pairingReasons);
      status = 'NOT_COMPARABLE';
    }
  }

  if (
    reasons.length === 0 &&
    !definitionScopeMatchesRun(definition, baselineRun)
  ) {
    reasons.push('BASELINE_SCOPE_BINDING_MISMATCH');
    status = 'NOT_EVALUABLE';
  }

  if (reasons.length === 0) {
    const candidateMetric = candidateRun.metricEvidence.find(
      (item) =>
        item.metric === candidateRun.scope.metric &&
        item.dimension === candidateRun.scope.dimension,
    );
    const baselineMetric = baselineRun.metricEvidence.find(
      (item) =>
        item.metric === baselineRun.scope.metric &&
        item.dimension === baselineRun.scope.dimension,
    );
    if (!candidateMetric || !baselineMetric) {
      reasons.push('REQUIRED_INPUT_MISSING');
      status = 'NOT_EVALUABLE';
    } else if (
      candidateMetric.status !== 'COMPUTED' ||
      baselineMetric.status !== 'COMPUTED'
    ) {
      reasons.push('METRIC_RESULT_NOT_EVALUABLE');
      status = 'NOT_EVALUABLE';
    }
  }

  if (reasons.length === 0) reasons.push('GOVERNED_PAIRING_SATISFIED');
  const content = {
    contractVersion: D11_CONTRACT_VERSION,
    methodologyVersion: D11_METHODOLOGY_VERSION,
    comparatorId: comparison.comparatorId,
    comparatorVersion: comparison.comparatorVersion,
    status,
    reasons: [...new Set(reasons)],
    semantics: 'DESCRIPTIVE_COMPARABILITY_ONLY' as const,
    automaticDecision: false as const,
    candidateRun,
    baselineDefinition: definition,
    ...(authority ? { baselineAuthority: authority } : {}),
    baselineRun,
    datasetIdentity: candidateRun.datasetIdentity,
    evaluationContractIdentity: candidateRun.evaluationContractIdentity,
  };
  return freeze({ ...content, comparisonHash: hashCanonical(content) });
}

export function verifyD11ComparisonArtifact(
  value: D11ComparisonArtifact,
): D11ComparisonArtifact {
  const artifact = snapshot(value, 'comparisonArtifact');
  const content = { ...artifact } as Record<string, unknown>;
  delete content.comparisonHash;
  if (hashCanonical(content) !== artifact.comparisonHash)
    fail(
      'COMPARISON_HASH_MISMATCH',
      'Comparison artifact hash does not match canonical content.',
    );
  const expected = compareD11EvaluationRuns({
    comparatorId: artifact.comparatorId,
    comparatorVersion: artifact.comparatorVersion,
    candidateRun: artifact.candidateRun,
    baselineDefinition: artifact.baselineDefinition,
    ...(artifact.baselineAuthority
      ? { baselineAuthority: artifact.baselineAuthority }
      : {}),
    baselineRun: artifact.baselineRun,
  });
  if (expected.comparisonHash !== artifact.comparisonHash)
    fail(
      'COMPARISON_HASH_MISMATCH',
      'Comparison artifact decision is stale or invalid.',
    );
  return expected;
}
