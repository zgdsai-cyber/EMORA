import { hashCanonical } from '../canonicalize';
import {
  D09_ACTIVE_METRICS,
  D09_PROPOSABLE_DIMENSIONS,
  D09_SCALE_DIRECTIONS,
  D09_SCALE_TYPES,
  D09_TEMPORAL_RELATIONSHIPS,
} from '../d09/contracts';
import {
  D10_CONTRACT_VERSION,
  D10_METHODOLOGY_STATUS,
  D10_PROHIBITED_CLAIMS,
  D10_THRESHOLD_DEFINITION,
} from './contracts';
import type {
  D10DerivationDataProvenance,
  D10MetricComputationStatus,
  D10ThresholdApplicabilityResult,
  D10ThresholdApplicationInput,
  D10ThresholdConfiguration,
  D10ThresholdConfigurationInput,
  D10ThresholdDefinitionArtifact,
  D10ThresholdDefinitionInput,
  D10ThresholdScope,
} from './contracts';

export type D10Violation =
  | 'INVALID_SHAPE'
  | 'UNKNOWN_FIELD'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_SCOPE'
  | 'INVALID_PROVENANCE'
  | 'INVALID_FREEZE'
  | 'RESULT_DERIVED_PROHIBITED'
  | 'FORBIDDEN_RULE_CONTENT'
  | 'NUMERICAL_THRESHOLD_PROHIBITED'
  | 'GLOBAL_OR_COMPOSITE_THRESHOLD_PROHIBITED'
  | 'UNAUTHORIZED_THRESHOLD'
  | 'CONFIGURATION_HASH_MISMATCH'
  | 'THRESHOLD_HASH_MISMATCH';

export class D10ValidationError extends Error {
  readonly violation: D10Violation;

  constructor(violation: D10Violation, message: string) {
    super(message);
    this.name = 'D10ValidationError';
    this.violation = violation;
  }
}

const SHA256 = /^[0-9a-f]{64}$/;
const CANONICAL_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]*$/;
const RULE_IDENTIFIER = /^[A-Za-z][A-Za-z._:-]*$/;
const VERSION = /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,2}(?:-[A-Za-z0-9.-]+)?$/;
const DECIMAL_LITERAL =
  /(?:^|[^A-Za-z0-9])[-+]?(?:\d+\.\d+|\.\d+)(?:$|[^A-Za-z0-9])/;
const FORBIDDEN_RULE_CONTENT =
  /(?:\b(?:cutoff|pass|fail|success|superior|winner|ranking|model[ _-]?score|scientific[ _-]?(?:validity|success))[A-Za-z]*\b|\b(?:weak|moderate|strong)[ _-]?(?:correlation|association)\b|\b(?:gte|lte|greater[ _-]?than|less[ _-]?than|at[ _-]?least|at[ _-]?most)\b|\b(?:pearson|correlation|association|r)[ _:=-]*(?:equals?[ _:=-]*)?[-+]?(?:\d+(?:\.\d+)?|\.\d+)\b|[<>]=?|[≥≤≷])/i;
const METRIC_STATUSES = Object.freeze([
  'COMPUTED',
  'INVALID',
  'INSUFFICIENT_DATA',
  'UNDEFINED',
] as const satisfies readonly D10MetricComputationStatus[]);

function fail(violation: D10Violation, message: string): never {
  throw new D10ValidationError(violation, message);
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
      if (key !== 'length') {
        const index = Number(key);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= value.length ||
          String(index) !== key
        )
          fail('INVALID_SHAPE', `${path}.${key} is not an array index.`);
      }
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
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      freeze(nested);
  }
  return value;
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
      const normalized = key.toLowerCase();
      if (normalized === 'resultderived' && value[key] === true)
        fail(
          'RESULT_DERIVED_PROHIBITED',
          `${path}.${key} is prohibited by D10.`,
        );
      if (
        /threshold.*(value|cutoff)|cutoff|alpha|pvalue|confidenceinterval/.test(
          normalized,
        )
      )
        fail(
          'NUMERICAL_THRESHOLD_PROHIBITED',
          `${path}.${key} is prohibited by D10.`,
        );
      if (
        /global|composite|weighted|ranking|winner|superiority|modelscore/.test(
          normalized,
        )
      )
        fail(
          'GLOBAL_OR_COMPOSITE_THRESHOLD_PROHIBITED',
          `${path}.${key} is prohibited by D10.`,
        );
      fail('UNKNOWN_FIELD', `${path}.${key} is not recognised.`);
    }
  }
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    fail('INVALID_SHAPE', `${path} must be a non-empty string.`);
  return value;
}

function identifier(value: unknown, path: string): string {
  const result = text(value, path);
  if (!IDENTIFIER.test(result))
    fail(
      'INVALID_SHAPE',
      `${path} must be an opaque identifier, not rule content.`,
    );
  return result;
}

function version(value: unknown, path: string): string {
  const result = text(value, path);
  if (!VERSION.test(result))
    fail(
      'INVALID_SHAPE',
      `${path} must be a version identifier, not rule content.`,
    );
  return result;
}

function noRuleContent(value: unknown, path: string): string {
  const result = text(value, path);
  if (FORBIDDEN_RULE_CONTENT.test(result))
    fail(
      'FORBIDDEN_RULE_CONTENT',
      `${path} must not encode a cutoff, verdict, ranking, or success rule.`,
    );
  return result;
}

function ruleIdentifier(value: unknown, path: string): string {
  const result = noRuleContent(identifier(value, path), path);
  if (!RULE_IDENTIFIER.test(result) || DECIMAL_LITERAL.test(result))
    fail(
      'FORBIDDEN_RULE_CONTENT',
      `${path} must not encode a numeric rule; use the dedicated version field for versions.`,
    );
  return result;
}

function exactVocabulary(
  value: unknown,
  expected: readonly string[],
  path: string,
): void {
  if (
    !Array.isArray(value) ||
    value.length !== expected.length ||
    new Set(value).size !== value.length ||
    value.some((item) => typeof item !== 'string') ||
    expected.some((item) => !value.includes(item))
  )
    fail(
      'INVALID_CONFIGURATION',
      `${path} must contain the frozen vocabulary exactly once.`,
    );
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

function validateScope(value: unknown, path: string): D10ThresholdScope {
  const scope = record(value, path);
  knownFields(
    scope,
    [
      'metric',
      'dimension',
      'construct',
      'pairedHumanIndicator',
      'instrument',
      'scale',
      'population',
      'context',
      'temporalRelationship',
      'transformationReference',
      'denominatorMissingnessRuleReference',
      'exclusionsReference',
    ],
    path,
  );
  oneOf(scope.metric, D09_ACTIVE_METRICS, `${path}.metric`);
  oneOf(scope.dimension, D09_PROPOSABLE_DIMENSIONS, `${path}.dimension`);
  for (const field of [
    'construct',
    'pairedHumanIndicator',
    'population',
    'context',
    'transformationReference',
    'denominatorMissingnessRuleReference',
    'exclusionsReference',
  ])
    noRuleContent(scope[field], `${path}.${field}`);

  const instrument = record(scope.instrument, `${path}.instrument`);
  knownFields(
    instrument,
    ['instrumentId', 'instrumentVersion', 'language'],
    `${path}.instrument`,
  );
  identifier(instrument.instrumentId, `${path}.instrument.instrumentId`);
  version(instrument.instrumentVersion, `${path}.instrument.instrumentVersion`);
  noRuleContent(instrument.language, `${path}.instrument.language`);

  const scale = record(scope.scale, `${path}.scale`);
  knownFields(
    scale,
    ['measurementUnit', 'scaleType', 'scaleDirection'],
    `${path}.scale`,
  );
  noRuleContent(scale.measurementUnit, `${path}.scale.measurementUnit`);
  oneOf(scale.scaleType, D09_SCALE_TYPES, `${path}.scale.scaleType`);
  oneOf(
    scale.scaleDirection,
    D09_SCALE_DIRECTIONS,
    `${path}.scale.scaleDirection`,
  );
  oneOf(
    scope.temporalRelationship,
    D09_TEMPORAL_RELATIONSHIPS,
    `${path}.temporalRelationship`,
  );
  return scope as unknown as D10ThresholdScope;
}

function validateDerivationData(
  value: unknown,
  path: string,
): D10DerivationDataProvenance {
  const derivation = record(value, path);
  if (derivation.role === 'DECLARED_NO_DERIVATION_DATA') {
    knownFields(derivation, ['role'], path);
    return derivation as unknown as D10DerivationDataProvenance;
  }
  if (derivation.role !== 'DECLARED_INDEPENDENT_DERIVATION_DATA')
    fail(
      'INVALID_PROVENANCE',
      `${path}.role must declare its relationship to interpreted results.`,
    );
  knownFields(derivation, ['role', 'identity'], path);
  const identity = record(derivation.identity, `${path}.identity`);
  knownFields(
    identity,
    ['dataId', 'dataVersion', 'dataHash'],
    `${path}.identity`,
  );
  noRuleContent(
    identifier(identity.dataId, `${path}.identity.dataId`),
    `${path}.identity.dataId`,
  );
  version(identity.dataVersion, `${path}.identity.dataVersion`);
  const hash = text(identity.dataHash, `${path}.identity.dataHash`);
  if (!SHA256.test(hash))
    fail('INVALID_PROVENANCE', `${path}.identity.dataHash must be SHA-256.`);
  return derivation as unknown as D10DerivationDataProvenance;
}

function validateThresholdDefinition(
  value: unknown,
  path: string,
): D10ThresholdDefinitionInput {
  const threshold = record(value, path);
  knownFields(
    threshold,
    [
      'thresholdId',
      'thresholdVersion',
      'rule',
      'scope',
      'provenance',
      'governance',
      'freeze',
    ],
    path,
  );
  ruleIdentifier(threshold.thresholdId, `${path}.thresholdId`);
  version(threshold.thresholdVersion, `${path}.thresholdVersion`);

  const rule = record(threshold.rule, `${path}.rule`);
  knownFields(
    rule,
    ['kind', 'ruleId', 'ruleVersion', 'declaredRuleContentHash'],
    `${path}.rule`,
  );
  if (rule.kind !== 'SCOPED_DESCRIPTIVE_INTERPRETATION_REFERENCE')
    fail(
      'INVALID_CONFIGURATION',
      `${path}.rule.kind is not a D10 descriptive rule reference.`,
    );
  ruleIdentifier(rule.ruleId, `${path}.rule.ruleId`);
  version(rule.ruleVersion, `${path}.rule.ruleVersion`);
  const ruleHash = text(
    rule.declaredRuleContentHash,
    `${path}.rule.declaredRuleContentHash`,
  );
  if (!SHA256.test(ruleHash))
    fail(
      'INVALID_CONFIGURATION',
      `${path}.rule.declaredRuleContentHash must be SHA-256.`,
    );

  validateScope(threshold.scope, `${path}.scope`);

  const provenance = record(threshold.provenance, `${path}.provenance`);
  knownFields(
    provenance,
    [
      'justificationSourceReference',
      'derivationData',
      'methodologyVersion',
      'configurationVersion',
      'emoraParameterVersion',
      'emoraEquationVersion',
    ],
    `${path}.provenance`,
  );
  noRuleContent(
    identifier(
      provenance.justificationSourceReference,
      `${path}.provenance.justificationSourceReference`,
    ),
    `${path}.provenance.justificationSourceReference`,
  );
  for (const field of [
    'methodologyVersion',
    'configurationVersion',
    'emoraParameterVersion',
    'emoraEquationVersion',
  ])
    noRuleContent(
      identifier(provenance[field], `${path}.provenance.${field}`),
      `${path}.provenance.${field}`,
    );
  validateDerivationData(
    provenance.derivationData,
    `${path}.provenance.derivationData`,
  );

  const governance = record(threshold.governance, `${path}.governance`);
  knownFields(
    governance,
    [
      'declaredResultIndependent',
      'declaredThresholdFrozenBeforeResults',
      'declaredDerivationProcedureFrozenBeforeResults',
    ],
    `${path}.governance`,
  );
  if (governance.declaredResultIndependent !== true)
    fail(
      'RESULT_DERIVED_PROHIBITED',
      'A D10 threshold must be declared independent of the results it interprets.',
    );
  if (
    governance.declaredThresholdFrozenBeforeResults !== true ||
    governance.declaredDerivationProcedureFrozenBeforeResults !== true
  )
    fail(
      'INVALID_FREEZE',
      'Threshold and derivation procedure must be declared frozen before relevant results.',
    );

  const freezeDefinition = record(threshold.freeze, `${path}.freeze`);
  knownFields(
    freezeDefinition,
    ['freezeVersion', 'declaredFrozenAt'],
    `${path}.freeze`,
  );
  noRuleContent(
    identifier(freezeDefinition.freezeVersion, `${path}.freeze.freezeVersion`),
    `${path}.freeze.freezeVersion`,
  );
  const frozenAt = text(
    freezeDefinition.declaredFrozenAt,
    `${path}.freeze.declaredFrozenAt`,
  );
  const parsedFrozenAt = Date.parse(frozenAt);
  if (
    !CANONICAL_ISO_TIMESTAMP.test(frozenAt) ||
    !Number.isFinite(parsedFrozenAt) ||
    new Date(parsedFrozenAt).toISOString() !== frozenAt
  )
    fail(
      'INVALID_FREEZE',
      `${path}.freeze.declaredFrozenAt must be a canonical UTC ISO-8601 timestamp.`,
    );

  return threshold as unknown as D10ThresholdDefinitionInput;
}

function createThresholdArtifact(
  input: D10ThresholdDefinitionInput,
): D10ThresholdDefinitionArtifact {
  validateThresholdDefinition(input, 'configuration.threshold');
  const scopeHash = hashCanonical(input.scope);
  const content = {
    ...input,
    governance: {
      ...input.governance,
      automaticTransfer: false as const,
      automaticDecision: false as const,
      externalChronologyVerification:
        'NOT_VERIFIED_NO_EXTERNAL_TIMELINE_AUTHORITY' as const,
    },
    authority: 'UNAUTHORIZED_FUTURE_THRESHOLD_PROPOSAL' as const,
    scopeHash,
  };
  return freeze({ ...content, thresholdHash: hashCanonical(content) });
}

function validateConfigurationBase(
  configuration: Record<string, unknown>,
): void {
  if (
    configuration.contractVersion !== D10_CONTRACT_VERSION ||
    configuration.methodologyStatus !== D10_METHODOLOGY_STATUS ||
    configuration.thresholdDefinition !== D10_THRESHOLD_DEFINITION ||
    configuration.humanData !== 'NONE' ||
    configuration.numericalThresholds !== 'NONE_DEFINED'
  )
    fail(
      'INVALID_CONFIGURATION',
      'D10 frozen methodology metadata is invalid.',
    );
  exactVocabulary(
    configuration.governedMetrics,
    D09_ACTIVE_METRICS,
    'configuration.governedMetrics',
  );
  exactVocabulary(
    configuration.prohibitedClaims,
    D10_PROHIBITED_CLAIMS,
    'configuration.prohibitedClaims',
  );
}

export function createD10ThresholdConfiguration(
  input: D10ThresholdConfigurationInput,
): D10ThresholdConfiguration {
  const configuration = snapshot(input, 'configuration');
  const root = record(configuration, 'configuration');
  const base = {
    contractVersion: D10_CONTRACT_VERSION,
    methodologyStatus: D10_METHODOLOGY_STATUS,
    thresholdDefinition: D10_THRESHOLD_DEFINITION,
    governedMetrics: [...D09_ACTIVE_METRICS],
    humanData: 'NONE' as const,
    numericalThresholds: 'NONE_DEFINED' as const,
    prohibitedClaims: [...D10_PROHIBITED_CLAIMS],
  };

  if (root.status === 'NO_THRESHOLD_DEFINED') {
    knownFields(root, ['status'], 'configuration');
    const content = { ...base, status: 'NO_THRESHOLD_DEFINED' as const };
    return freeze({
      ...content,
      configurationHash: hashCanonical(content),
    }) as D10ThresholdConfiguration;
  }
  if (root.status !== 'PREDEFINED_SCOPE_BOUND_RULE')
    fail('INVALID_CONFIGURATION', 'D10 threshold existence status is invalid.');
  knownFields(root, ['status', 'threshold'], 'configuration');
  const threshold = createThresholdArtifact(
    root.threshold as unknown as D10ThresholdDefinitionInput,
  );
  const content = {
    ...base,
    status: 'PREDEFINED_SCOPE_BOUND_RULE' as const,
    threshold,
  };
  return freeze({
    ...content,
    configurationHash: hashCanonical(content),
  }) as D10ThresholdConfiguration;
}

export const D10_THRESHOLD_METHODOLOGY_1_0_0 = createD10ThresholdConfiguration({
  status: 'NO_THRESHOLD_DEFINED',
});

function verifyConfiguration(
  value: D10ThresholdConfiguration,
): D10ThresholdConfiguration {
  const artifact = snapshot(value, 'configurationArtifact');
  const root = record(artifact, 'configurationArtifact');
  const baseFields = [
    'contractVersion',
    'methodologyStatus',
    'thresholdDefinition',
    'governedMetrics',
    'humanData',
    'numericalThresholds',
    'prohibitedClaims',
    'status',
    'configurationHash',
  ];
  validateConfigurationBase(root);
  const suppliedHash = text(
    root.configurationHash,
    'configurationArtifact.configurationHash',
  );
  if (!SHA256.test(suppliedHash))
    fail('CONFIGURATION_HASH_MISMATCH', 'configurationHash must be SHA-256.');
  const artifactContent = { ...artifact } as unknown as Record<string, unknown>;
  delete artifactContent.configurationHash;
  if (hashCanonical(artifactContent) !== suppliedHash)
    fail(
      'CONFIGURATION_HASH_MISMATCH',
      'configurationHash does not match the supplied artifact content.',
    );
  let expected: D10ThresholdConfiguration;
  if (artifact.status === 'PREDEFINED_SCOPE_BOUND_RULE') {
    knownFields(root, [...baseFields, 'threshold'], 'configurationArtifact');
    const threshold = record(
      artifact.threshold,
      'configurationArtifact.threshold',
    );
    const suppliedThresholdHash = text(
      threshold.thresholdHash,
      'configurationArtifact.threshold.thresholdHash',
    );
    if (!SHA256.test(suppliedThresholdHash))
      fail('THRESHOLD_HASH_MISMATCH', 'thresholdHash must be SHA-256.');
    const suppliedThresholdContent = { ...threshold };
    delete suppliedThresholdContent.thresholdHash;
    if (hashCanonical(suppliedThresholdContent) !== suppliedThresholdHash)
      fail(
        'THRESHOLD_HASH_MISMATCH',
        'thresholdHash does not match the supplied threshold content.',
      );
    const thresholdInput = { ...threshold };
    if (thresholdInput.authority !== 'UNAUTHORIZED_FUTURE_THRESHOLD_PROPOSAL')
      fail(
        'UNAUTHORIZED_THRESHOLD',
        'D10 has no authorized threshold definition.',
      );
    delete thresholdInput.authority;
    delete thresholdInput.scopeHash;
    delete thresholdInput.thresholdHash;
    const governance = record(
      thresholdInput.governance,
      'configurationArtifact.threshold.governance',
    );
    const governanceInput = { ...governance };
    delete governanceInput.automaticTransfer;
    delete governanceInput.automaticDecision;
    delete governanceInput.externalChronologyVerification;
    thresholdInput.governance = governanceInput;
    expected = createD10ThresholdConfiguration({
      status: 'PREDEFINED_SCOPE_BOUND_RULE',
      threshold: thresholdInput as unknown as D10ThresholdDefinitionInput,
    });
  } else if (artifact.status === 'NO_THRESHOLD_DEFINED') {
    knownFields(root, baseFields, 'configurationArtifact');
    expected = createD10ThresholdConfiguration({
      status: 'NO_THRESHOLD_DEFINED',
    });
  } else {
    fail('INVALID_CONFIGURATION', 'D10 threshold existence status is invalid.');
  }
  if (expected.configurationHash !== suppliedHash)
    fail(
      'CONFIGURATION_HASH_MISMATCH',
      'configurationHash does not match D10 artifact content.',
    );
  if (
    artifact.status === 'PREDEFINED_SCOPE_BOUND_RULE' &&
    expected.status === 'PREDEFINED_SCOPE_BOUND_RULE' &&
    expected.threshold.thresholdHash !== artifact.threshold.thresholdHash
  )
    fail(
      'THRESHOLD_HASH_MISMATCH',
      'thresholdHash does not match governed threshold content.',
    );
  return expected;
}

export function assessD10ThresholdApplicability(
  configuration: D10ThresholdConfiguration,
  input: D10ThresholdApplicationInput,
): D10ThresholdApplicabilityResult {
  const governed = verifyConfiguration(configuration);
  const application = snapshot(input, 'application');
  const root = record(application, 'application');
  knownFields(root, ['metricResult', 'scope'], 'application');
  const metricResult = record(root.metricResult, 'application.metricResult');
  knownFields(
    metricResult,
    [
      'metricId',
      'dimension',
      'value',
      'sampleSize',
      'missingCasesCount',
      'status',
      'failureReason',
    ],
    'application.metricResult',
  );
  oneOf(
    metricResult.metricId,
    D09_ACTIVE_METRICS,
    'application.metricResult.metricId',
  );
  oneOf(
    metricResult.dimension,
    D09_PROPOSABLE_DIMENSIONS,
    'application.metricResult.dimension',
  );
  const metricStatus = oneOf(
    metricResult.status,
    METRIC_STATUSES,
    'application.metricResult.status',
  );
  if (typeof metricResult.value !== 'number')
    fail('INVALID_SHAPE', 'application.metricResult.value must be numeric.');
  for (const field of ['sampleSize', 'missingCasesCount']) {
    const count = metricResult[field];
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)
      fail(
        'INVALID_SHAPE',
        `application.metricResult.${field} must be a non-negative safe integer.`,
      );
  }
  const sampleSize = metricResult.sampleSize as number;
  if (metricStatus === 'COMPUTED' && !Number.isFinite(metricResult.value))
    fail('INVALID_SHAPE', 'A COMPUTED metric result must have a finite value.');
  if (metricStatus !== 'COMPUTED' && !Number.isNaN(metricResult.value))
    fail(
      'INVALID_SHAPE',
      'A non-computed metric result must preserve the existing NaN value representation.',
    );
  if (
    metricStatus === 'COMPUTED' &&
    metricResult.metricId === 'PEARSON_R' &&
    (metricResult.value < -1 || metricResult.value > 1)
  )
    fail(
      'INVALID_SHAPE',
      'A COMPUTED Pearson result must remain within its governed metric range.',
    );
  if (
    metricStatus === 'COMPUTED' &&
    metricResult.metricId === 'PEARSON_R' &&
    sampleSize < 2
  )
    fail(
      'INVALID_SHAPE',
      'A COMPUTED Pearson result must satisfy the governed technical minimum sample size.',
    );
  if (
    metricStatus === 'UNDEFINED' &&
    metricResult.metricId === 'PEARSON_R' &&
    sampleSize < 2
  )
    fail(
      'INVALID_SHAPE',
      'An UNDEFINED Pearson result requires enough observations to reach the variance check.',
    );
  if (
    metricStatus === 'INSUFFICIENT_DATA' &&
    metricResult.metricId === 'PEARSON_R' &&
    sampleSize >= 2
  )
    fail(
      'INVALID_SHAPE',
      'An INSUFFICIENT_DATA Pearson result must remain below the governed technical minimum sample size.',
    );
  if (metricResult.missingCasesCount !== 0)
    fail(
      'INVALID_SHAPE',
      'MetricResult.missingCasesCount is a legacy field and must remain zero.',
    );
  if (metricStatus === 'COMPUTED' && 'failureReason' in metricResult)
    fail(
      'INVALID_SHAPE',
      'A COMPUTED metric result must not include a failureReason.',
    );
  if ('failureReason' in metricResult)
    text(metricResult.failureReason, 'application.metricResult.failureReason');
  const scope = validateScope(root.scope, 'application.scope');
  const metricResultHash = hashCanonical({
    metricId: metricResult.metricId,
    dimension: metricResult.dimension,
    value: Number.isFinite(metricResult.value)
      ? {
          kind: 'FINITE',
          value: metricResult.value,
          negativeZero: Object.is(metricResult.value, -0),
        }
      : { kind: 'NAN' },
    sampleSize: metricResult.sampleSize,
    missingCasesCount: metricResult.missingCasesCount,
    status: metricStatus,
    ...('failureReason' in metricResult
      ? { failureReason: metricResult.failureReason }
      : {}),
  });
  const attemptedScopeHash = hashCanonical(scope);

  let content: Omit<D10ThresholdApplicabilityResult, 'resultHash'>;
  if (governed.status === 'NO_THRESHOLD_DEFINED') {
    content = {
      status: 'NO_THRESHOLD_DEFINED',
      metricStatus,
      metricResultHash,
      attemptedScopeHash,
      configurationHash: governed.configurationHash,
      interpretation: 'NONE',
      automaticDecision: false,
    };
  } else if (metricStatus !== 'COMPUTED') {
    content = {
      status: 'NOT_EVALUABLE_METRIC_STATUS',
      metricStatus,
      metricResultHash,
      attemptedScopeHash,
      configurationHash: governed.configurationHash,
      thresholdId: governed.threshold.thresholdId,
      thresholdHash: governed.threshold.thresholdHash,
      scopeHash: governed.threshold.scopeHash,
      interpretation: 'NONE',
      automaticDecision: false,
    };
  } else if (
    metricResult.metricId !== scope.metric ||
    metricResult.dimension !== scope.dimension ||
    attemptedScopeHash !== governed.threshold.scopeHash
  ) {
    content = {
      status: 'NOT_APPLICABLE_SCOPE_MISMATCH',
      metricStatus,
      metricResultHash,
      attemptedScopeHash,
      configurationHash: governed.configurationHash,
      thresholdId: governed.threshold.thresholdId,
      thresholdHash: governed.threshold.thresholdHash,
      scopeHash: governed.threshold.scopeHash,
      interpretation: 'NONE',
      automaticDecision: false,
    };
  } else if (
    governed.threshold.authority !== 'UNAUTHORIZED_FUTURE_THRESHOLD_PROPOSAL'
  ) {
    fail(
      'UNAUTHORIZED_THRESHOLD',
      'D10 has no authorized threshold definition.',
    );
  } else {
    content = {
      status: 'NOT_APPLICABLE_UNAUTHORIZED_THRESHOLD',
      metricStatus,
      metricResultHash,
      attemptedScopeHash,
      configurationHash: governed.configurationHash,
      thresholdId: governed.threshold.thresholdId,
      thresholdHash: governed.threshold.thresholdHash,
      scopeHash: governed.threshold.scopeHash,
      interpretation: 'NONE',
      automaticDecision: false,
    };
  }
  return freeze({ ...content, resultHash: hashCanonical(content) });
}
