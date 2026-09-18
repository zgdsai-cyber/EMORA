import { hashCanonical } from '../canonicalize';
import {
  COMPUTATIONAL_ONLY_OUTPUTS,
  CONSTRUCT_MAPPING_TYPES,
  DESCRIPTIVE_CRITERION_KINDS,
  ETHICS_GOVERNANCE_REQUIREMENTS,
  FALSIFIABILITY_OUTCOMES,
  HUMAN_EVALUATION_OUTPUTS,
  HUMAN_MISSINGNESS_STATES,
  HUMAN_PROTOCOL_STATUSES,
  LEAKAGE_CONTROLS,
  OBSERVATION_FIELD_IDS,
  REQUIRED_REPRODUCIBILITY_FIELDS,
  SCIENTIFIC_BOUNDARY_STATEMENTS,
} from './contracts';
import type {
  HumanBehavioralEvaluationProtocol,
  HumanBehavioralEvaluationProtocolInput,
  HumanProtocolStatus,
} from './contracts';

export type HumanMethodologyViolation =
  | 'INVALID_SHAPE'
  | 'UNKNOWN_FIELD'
  | 'FORBIDDEN_SCOPE'
  | 'INVALID_ENUM'
  | 'INVALID_STATUS_CONFIGURATION'
  | 'INCOMPLETE_OBSERVATION_SCHEMA'
  | 'INVALID_SCOPE'
  | 'INVALID_MAPPING'
  | 'INVALID_CRITERION'
  | 'INVALID_GOVERNANCE_REQUIREMENT';

export class HumanMethodologyValidationError extends Error {
  readonly violation: HumanMethodologyViolation;

  constructor(violation: HumanMethodologyViolation, message: string) {
    super(message);
    this.name = 'HumanMethodologyValidationError';
    this.violation = violation;
  }
}

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const FORBIDDEN_FIELDS = Object.freeze([
  'score',
  'rank',
  'ranking',
  'winner',
  'recommendation',
  'selection',
  'selected',
  'scientificSupportLabel',
  'scientificValidity',
  'pValue',
  'confidenceInterval',
  'hypothesisTest',
  'inferentialStatistic',
  'causalEffect',
  'clinicalDiagnosis',
  'clinicalInterpretation',
  'calibration',
  'optimization',
  'trainedModel',
  'causalInference',
  'hypothesisTesting',
  'machineLearning',
  'hybridFusion',
  'compositeValidityScore',
  'overallHumanValidityScore',
]);

const FORBIDDEN_FIELD_KEYS = new Set(
  FORBIDDEN_FIELDS.map((field) => field.toLowerCase().replace(/[^a-z0-9]/g, '')),
);

const FORBIDDEN_OPERATIONAL_CONCEPTS = [
  'pvalue',
  'confidenceinterval',
  'hypothesistest',
  'hypothesistesting',
  'inferentialstatistic',
  'causaleffect',
  'causalinference',
  'calibration',
  'optimization',
  'optimisation',
  'machinelearning',
  'hybridfusion',
  'ranking',
  'rankmodels',
  'winner',
  'recommend',
  'recommendation',
  'select',
  'selection',
  'score',
  'superiority',
  'trainedmodel',
  'modeltraining',
  'scientificsupportlabel',
  'scientificvalidityscore',
  'compositevalidityscore',
  'clinicaldiagnosis',
  'clinicalinterpretation',
  'diagnosticoutput',
] as const;

const ROOT_FIELDS = Object.freeze([
  'protocolId',
  'protocolVersion',
  'methodologyVersion',
  'status',
  'issuedDate',
  'scope',
  'population',
  'observationSchema',
  'constructMappings',
  'descriptiveCriteria',
  'baselines',
  'temporalEvaluation',
  'individualDifferences',
  'partitioning',
  'leakageControls',
  'falsifiabilityConditions',
  'reproducibility',
  'ethicsGovernance',
  'scientificBoundary',
  'unresolvedItems',
]);

function fail(
  violation: HumanMethodologyViolation,
  message: string,
): never {
  throw new HumanMethodologyValidationError(violation, message);
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
        )
          fail('INVALID_SHAPE', `${path}.${key} is not an array index.`);
      }
    }
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
        fail('INVALID_SHAPE', `${path}[${index}] must be a data property.`);
      result.push(snapshot(descriptor.value, `${path}[${index}]`, active));
    }
    active.delete(value);
    return result as T;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    fail('INVALID_SHAPE', `${path} must be a plain data object.`);
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol')
      fail('INVALID_SHAPE', `${path} must not contain symbol properties.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
      fail('INVALID_SHAPE', `${path}.${key} must be a data property.`);
    Object.defineProperty(result, key, {
      value: snapshot(descriptor.value, `${path}.${key}`, active),
      enumerable: true,
      configurable: true,
      writable: true,
    });
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
  allowed: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (FORBIDDEN_FIELD_KEYS.has(normalizedKey))
      fail('FORBIDDEN_SCOPE', `${path}.${key} is forbidden.`);
    if (!allowed.includes(key))
      fail('UNKNOWN_FIELD', `${path}.${key} is not recognised.`);
    if (value[key] === undefined)
      fail('INVALID_SHAPE', `${path}.${key} must not be explicitly undefined.`);
  }
}

function operationalText(value: unknown, path: string): string {
  const result = text(value, path);
  const normalized = result.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    FORBIDDEN_OPERATIONAL_CONCEPTS.some((concept) =>
      normalized.includes(concept),
    ) ||
    /\bml\b/i.test(result)
  )
    fail('FORBIDDEN_SCOPE', `${path} contains a forbidden methodology concept.`);
  return result;
}

function stringArray(value: unknown, path: string): readonly string[] {
  const values = array(value, path);
  values.forEach((item, index) => text(item, `${path}[${index}]`));
  return values as readonly string[];
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    fail('INVALID_SHAPE', `${path} must be a non-empty string.`);
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T))
    fail('INVALID_ENUM', `${path} has an invalid value.`);
  return value as T;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail('INVALID_SHAPE', `${path} must be an array.`);
  return value;
}

function uniqueExactSet(
  value: unknown,
  expected: readonly string[],
  path: string,
): void {
  const values = array(value, path);
  if (
    values.some((item) => typeof item !== 'string') ||
    values.length !== expected.length ||
    new Set(values).size !== values.length ||
    expected.some((item) => !values.includes(item))
  )
    fail(
      'INVALID_GOVERNANCE_REQUIREMENT',
      `${path} must contain the complete governed vocabulary exactly once.`,
    );
}

function validateState(
  value: Record<string, unknown>,
  path: string,
): HumanProtocolStatus {
  const status = oneOf(value.status, HUMAN_PROTOCOL_STATUSES, `${path}.status`);
  text(value.description, `${path}.description`);
  if (status === 'DEFINED' && value.unresolvedReason !== undefined)
    fail(
      'INVALID_STATUS_CONFIGURATION',
      `${path} cannot have unresolvedReason when DEFINED.`,
    );
  if (status !== 'DEFINED') text(value.unresolvedReason, `${path}.unresolvedReason`);
  return status;
}

function validateScope(value: unknown): void {
  const scope = record(value, 'protocol.scope');
  knownFields(
    scope,
    [
      'targetOutputs',
      'excludedOutputs',
      'computationalOnlyOutputs',
      'deferredComponents',
    ],
    'protocol.scope',
  );
  const targets = array(scope.targetOutputs, 'protocol.scope.targetOutputs');
  const excluded = array(scope.excludedOutputs, 'protocol.scope.excludedOutputs');
  for (const [name, values] of [
    ['targetOutputs', targets],
    ['excludedOutputs', excluded],
  ] as const) {
    if (
      values.some(
        (item) =>
          typeof item !== 'string' || !HUMAN_EVALUATION_OUTPUTS.includes(item as never),
      ) ||
      new Set(values).size !== values.length
    )
      fail('INVALID_SCOPE', `protocol.scope.${name} is invalid.`);
  }
  if (targets.some((item) => excluded.includes(item)))
    fail('INVALID_SCOPE', 'Target and excluded outputs must be disjoint.');
  if (
    targets.length + excluded.length !== HUMAN_EVALUATION_OUTPUTS.length ||
    HUMAN_EVALUATION_OUTPUTS.some(
      (item) => !targets.includes(item) && !excluded.includes(item),
    )
  )
    fail(
      'INVALID_SCOPE',
      'Every behavioral output must be explicitly targeted or excluded.',
    );
  uniqueExactSet(
    scope.computationalOnlyOutputs,
    COMPUTATIONAL_ONLY_OUTPUTS,
    'protocol.scope.computationalOnlyOutputs',
  );
  uniqueExactSet(
    scope.deferredComponents,
    ['HYBRID_FUSION'],
    'protocol.scope.deferredComponents',
  );
}

function validatePopulation(value: unknown): HumanProtocolStatus {
  const population = record(value, 'protocol.population');
  knownFields(
    population,
    [
      'status',
      'description',
      'unresolvedReason',
      'targetPopulation',
      'contextDefinition',
      'inclusionCriteria',
      'exclusionCriteria',
    ],
    'protocol.population',
  );
  const status = validateState(population, 'protocol.population');
  if (population.targetPopulation !== undefined)
    text(population.targetPopulation, 'protocol.population.targetPopulation');
  if (population.contextDefinition !== undefined)
    text(population.contextDefinition, 'protocol.population.contextDefinition');
  if (population.inclusionCriteria !== undefined)
    stringArray(
      population.inclusionCriteria,
      'protocol.population.inclusionCriteria',
    );
  if (population.exclusionCriteria !== undefined)
    stringArray(
      population.exclusionCriteria,
      'protocol.population.exclusionCriteria',
    );
  if (status === 'DEFINED') {
    text(population.targetPopulation, 'protocol.population.targetPopulation');
    text(population.contextDefinition, 'protocol.population.contextDefinition');
    stringArray(
      population.inclusionCriteria,
      'protocol.population.inclusionCriteria',
    );
    stringArray(
      population.exclusionCriteria,
      'protocol.population.exclusionCriteria',
    );
  }
  return status;
}

function validateObservationSchema(value: unknown): HumanProtocolStatus[] {
  const schema = record(value, 'protocol.observationSchema');
  knownFields(
    schema,
    [
      'status',
      'description',
      'unresolvedReason',
      'fields',
      'missingnessStates',
      'dataCollection',
    ],
    'protocol.observationSchema',
  );
  const schemaStatus = validateState(schema, 'protocol.observationSchema');
  if (schema.dataCollection !== 'NONE_METHODOLOGY_ONLY')
    fail('FORBIDDEN_SCOPE', 'Human data collection is not implemented.');
  uniqueExactSet(
    schema.missingnessStates,
    HUMAN_MISSINGNESS_STATES,
    'protocol.observationSchema.missingnessStates',
  );
  const statuses: HumanProtocolStatus[] = [schemaStatus];
  const ids = new Set<string>();
  for (const [index, item] of array(schema.fields, 'protocol.observationSchema.fields').entries()) {
    const path = `protocol.observationSchema.fields[${index}]`;
    const field = record(item, path);
    knownFields(
      field,
      ['fieldId', 'required', 'status', 'description', 'unresolvedReason'],
      path,
    );
    const fieldId = oneOf(field.fieldId, OBSERVATION_FIELD_IDS, `${path}.fieldId`);
    if (ids.has(fieldId))
      fail('INCOMPLETE_OBSERVATION_SCHEMA', `${path} duplicates ${fieldId}.`);
    ids.add(fieldId);
    if (field.required !== true)
      fail('INCOMPLETE_OBSERVATION_SCHEMA', `${path}.required must be true.`);
    statuses.push(validateState(field, path));
  }
  if (
    ids.size !== OBSERVATION_FIELD_IDS.length ||
    OBSERVATION_FIELD_IDS.some((id) => !ids.has(id))
  )
    fail(
      'INCOMPLETE_OBSERVATION_SCHEMA',
      'The conceptual observation schema is incomplete.',
    );
  if (
    schemaStatus === 'DEFINED' &&
    statuses.slice(1).some((status) => status !== 'DEFINED')
  )
    fail(
      'INVALID_STATUS_CONFIGURATION',
      'A DEFINED observation schema cannot contain unresolved fields.',
    );
  return statuses;
}

function validateMappings(
  value: unknown,
  targetOutputs: readonly unknown[],
): HumanProtocolStatus[] {
  const statuses: HumanProtocolStatus[] = [];
  const outputs = new Set<string>();
  const mappingIds = new Set<string>();
  for (const [index, item] of array(value, 'protocol.constructMappings').entries()) {
    const path = `protocol.constructMappings[${index}]`;
    const mapping = record(item, path);
    knownFields(
      mapping,
      [
        'mappingId',
        'emoraOutput',
        'humanConstruct',
        'measurementDefinition',
        'mappingType',
        'evidenceProvenanceReference',
        'status',
        'description',
        'unresolvedReason',
      ],
      path,
    );
    const mappingId = text(mapping.mappingId, `${path}.mappingId`);
    if (mappingIds.has(mappingId))
      fail('INVALID_MAPPING', `${path} duplicates mappingId ${mappingId}.`);
    mappingIds.add(mappingId);
    const output = oneOf(
      mapping.emoraOutput,
      HUMAN_EVALUATION_OUTPUTS,
      `${path}.emoraOutput`,
    );
    if (!targetOutputs.includes(output) || outputs.has(output))
      fail('INVALID_MAPPING', `${path}.emoraOutput is duplicate or not targeted.`);
    outputs.add(output);
    const status = validateState(mapping, path);
    statuses.push(status);
    const mappingType = oneOf(
      mapping.mappingType,
      CONSTRUCT_MAPPING_TYPES,
      `${path}.mappingType`,
    );
    if (mapping.humanConstruct !== undefined)
      operationalText(mapping.humanConstruct, `${path}.humanConstruct`);
    if (mapping.measurementDefinition !== undefined)
      operationalText(
        mapping.measurementDefinition,
        `${path}.measurementDefinition`,
      );
    if (mapping.evidenceProvenanceReference !== undefined)
      text(
        mapping.evidenceProvenanceReference,
        `${path}.evidenceProvenanceReference`,
      );
    if (status === 'DEFINED') {
      text(mapping.humanConstruct, `${path}.humanConstruct`);
      text(mapping.measurementDefinition, `${path}.measurementDefinition`);
      text(
        mapping.evidenceProvenanceReference,
        `${path}.evidenceProvenanceReference`,
      );
      if (
        mappingType === 'COMPUTATIONAL_ONLY' ||
        mappingType === 'NOT_SUITABLE_FOR_HUMAN_EVALUATION'
      )
        fail(
          'INVALID_MAPPING',
          `${path} cannot be DEFINED with a non-evaluable mapping type.`,
        );
    }
    if (
      status === 'NOT_EVALUABLE' &&
      mappingType !== 'NOT_SUITABLE_FOR_HUMAN_EVALUATION'
    )
      fail(
        'INVALID_MAPPING',
        `${path} NOT_EVALUABLE requires NOT_SUITABLE_FOR_HUMAN_EVALUATION.`,
      );
  }
  if (
    outputs.size !== targetOutputs.length ||
    targetOutputs.some((output) => !outputs.has(String(output)))
  )
    fail('INVALID_MAPPING', 'Every targeted output requires one mapping record.');
  return statuses;
}

function validateCriteria(
  value: unknown,
  mappingStatuses: ReadonlyMap<string, HumanProtocolStatus>,
): HumanProtocolStatus[] {
  const statuses: HumanProtocolStatus[] = [];
  const ids = new Set<string>();
  const kinds = new Set<string>();
  for (const [index, item] of array(value, 'protocol.descriptiveCriteria').entries()) {
    const path = `protocol.descriptiveCriteria[${index}]`;
    const criterion = record(item, path);
    knownFields(
      criterion,
      [
        'criterionId',
        'kind',
        'mappingIds',
        'predefinedDefinition',
        'status',
        'description',
        'unresolvedReason',
      ],
      path,
    );
    const id = text(criterion.criterionId, `${path}.criterionId`);
    if (ids.has(id)) fail('INVALID_CRITERION', `${path} duplicates ${id}.`);
    ids.add(id);
    kinds.add(
      oneOf(criterion.kind, DESCRIPTIVE_CRITERION_KINDS, `${path}.kind`),
    );
    const mappingReferences = array(criterion.mappingIds, `${path}.mappingIds`);
    if (
      mappingReferences.some(
        (mappingId) =>
          typeof mappingId !== 'string' || !mappingStatuses.has(mappingId),
      )
    )
      fail('INVALID_CRITERION', `${path} references an unknown mapping.`);
    const status = validateState(criterion, path);
    statuses.push(status);
    if (criterion.predefinedDefinition !== undefined)
      operationalText(
        criterion.predefinedDefinition,
        `${path}.predefinedDefinition`,
      );
    if (status === 'DEFINED') {
      text(criterion.predefinedDefinition, `${path}.predefinedDefinition`);
      if (
        mappingReferences.some(
          (mappingId) => mappingStatuses.get(String(mappingId)) !== 'DEFINED',
        ) ||
        (criterion.kind !== 'COVERAGE_MISSINGNESS_REPORTING' &&
          mappingReferences.length === 0)
      )
        fail(
          'INVALID_CRITERION',
          `${path} DEFINED requires at least one DEFINED construct mapping.`,
        );
    }
  }
  if (
    kinds.size !== DESCRIPTIVE_CRITERION_KINDS.length ||
    DESCRIPTIVE_CRITERION_KINDS.some((kind) => !kinds.has(kind))
  )
    fail(
      'INVALID_CRITERION',
      'Every governed descriptive criterion kind must be represented.',
    );
  return statuses;
}

function validateBaselines(value: unknown): HumanProtocolStatus[] {
  const baselines = record(value, 'protocol.baselines');
  knownFields(
    baselines,
    [
      'status',
      'description',
      'unresolvedReason',
      'definitions',
      'execution',
      'comparisonInterpretation',
    ],
    'protocol.baselines',
  );
  if (
    baselines.execution !== 'NOT_IMPLEMENTED' ||
    baselines.comparisonInterpretation !== 'DESCRIPTIVE_SIDE_BY_SIDE_ONLY'
  )
    fail('FORBIDDEN_SCOPE', 'Baseline execution, ranking, or selection is forbidden.');
  const statuses = [validateState(baselines, 'protocol.baselines')];
  const ids = new Set<string>();
  for (const [index, item] of array(baselines.definitions, 'protocol.baselines.definitions').entries()) {
    const path = `protocol.baselines.definitions[${index}]`;
    const baseline = record(item, path);
    knownFields(
      baseline,
      [
        'baselineId',
        'baselineVersion',
        'baselineKind',
        'configurationHash',
        'rationale',
        'status',
        'description',
        'unresolvedReason',
      ],
      path,
    );
    const id = text(baseline.baselineId, `${path}.baselineId`);
    if (ids.has(id)) fail('INVALID_SHAPE', `${path} duplicates ${id}.`);
    ids.add(id);
    text(baseline.baselineVersion, `${path}.baselineVersion`);
    oneOf(
      baseline.baselineKind,
      ['CONSTANT', 'DETERMINISTIC_ABLATION', 'PERSISTENCE', 'OTHER_PREDEFINED'],
      `${path}.baselineKind`,
    );
    const status = validateState(baseline, path);
    statuses.push(status);
    if (baseline.configurationHash !== undefined) {
      const hash = text(
        baseline.configurationHash,
        `${path}.configurationHash`,
      );
      if (!HASH_PATTERN.test(hash))
        fail('INVALID_SHAPE', `${path}.configurationHash must be SHA-256.`);
    }
    if (baseline.rationale !== undefined)
      operationalText(baseline.rationale, `${path}.rationale`);
    if (status === 'DEFINED') {
      const hash = text(baseline.configurationHash, `${path}.configurationHash`);
      if (!HASH_PATTERN.test(hash))
        fail('INVALID_SHAPE', `${path}.configurationHash must be SHA-256.`);
      text(baseline.rationale, `${path}.rationale`);
    }
  }
  if (
    statuses[0] === 'DEFINED' &&
    statuses.slice(1).some((status) => status !== 'DEFINED')
  )
    fail(
      'INVALID_STATUS_CONFIGURATION',
      'A DEFINED baseline protocol cannot contain unresolved definitions.',
    );
  if (statuses[0] === 'DEFINED' && statuses.length === 1)
    fail(
      'INVALID_STATUS_CONFIGURATION',
      'A DEFINED baseline protocol must contain a predefined baseline.',
    );
  return statuses;
}

function validateTemporal(value: unknown): HumanProtocolStatus {
  const temporal = record(value, 'protocol.temporalEvaluation');
  knownFields(
    temporal,
    [
      'status',
      'description',
      'unresolvedReason',
      'repeatedObservationsRepresented',
      'orderingRequired',
      'observationIntervalsRequired',
      'withinPersonBetweenPersonSeparated',
      'missingObservationsExplicit',
      'participantAggregationPredefined',
      'intervalPolicy',
      'participantAggregationDefinition',
      'statisticalModel',
    ],
    'protocol.temporalEvaluation',
  );
  for (const field of [
    'repeatedObservationsRepresented',
    'orderingRequired',
    'observationIntervalsRequired',
    'withinPersonBetweenPersonSeparated',
    'missingObservationsExplicit',
    'participantAggregationPredefined',
  ])
    if (temporal[field] !== true)
      fail('INVALID_SHAPE', `protocol.temporalEvaluation.${field} must be true.`);
  if (temporal.statisticalModel !== 'NONE')
    fail('FORBIDDEN_SCOPE', 'Temporal statistical models are not implemented.');
  const status = validateState(temporal, 'protocol.temporalEvaluation');
  if (temporal.intervalPolicy !== undefined)
    text(temporal.intervalPolicy, 'protocol.temporalEvaluation.intervalPolicy');
  if (temporal.participantAggregationDefinition !== undefined)
    operationalText(
      temporal.participantAggregationDefinition,
      'protocol.temporalEvaluation.participantAggregationDefinition',
    );
  if (status === 'DEFINED') {
    text(temporal.intervalPolicy, 'protocol.temporalEvaluation.intervalPolicy');
    operationalText(
      temporal.participantAggregationDefinition,
      'protocol.temporalEvaluation.participantAggregationDefinition',
    );
  }
  return status;
}

function validatePartitioning(value: unknown): HumanProtocolStatus {
  const partitioning = record(value, 'protocol.partitioning');
  knownFields(
    partitioning,
    [
      'status',
      'description',
      'unresolvedReason',
      'designEvaluationSeparated',
      'participantLevelHeldOutWhereApplicable',
      'designPartitionDefinition',
      'evaluationPartitionDefinition',
    ],
    'protocol.partitioning',
  );
  if (
    partitioning.designEvaluationSeparated !== true ||
    partitioning.participantLevelHeldOutWhereApplicable !== true
  )
    fail(
      'INVALID_SHAPE',
      'protocol.partitioning must preserve design/evaluation and participant separation.',
    );
  const status = validateState(partitioning, 'protocol.partitioning');
  if (partitioning.designPartitionDefinition !== undefined)
    text(
      partitioning.designPartitionDefinition,
      'protocol.partitioning.designPartitionDefinition',
    );
  if (partitioning.evaluationPartitionDefinition !== undefined)
    text(
      partitioning.evaluationPartitionDefinition,
      'protocol.partitioning.evaluationPartitionDefinition',
    );
  if (status === 'DEFINED') {
    text(
      partitioning.designPartitionDefinition,
      'protocol.partitioning.designPartitionDefinition',
    );
    text(
      partitioning.evaluationPartitionDefinition,
      'protocol.partitioning.evaluationPartitionDefinition',
    );
  }
  return status;
}

function validateIndividualDifferences(value: unknown): HumanProtocolStatus {
  const individual = record(value, 'protocol.individualDifferences');
  knownFields(
    individual,
    [
      'status',
      'description',
      'unresolvedReason',
      'populationLevelSeparated',
      'individualPatternsSeparated',
      'stableDifferencesRequireRepeatedContexts',
      'independentTraitMeasurementRequired',
      'emoraTraitAccuracyClaim',
    ],
    'protocol.individualDifferences',
  );
  for (const field of [
    'populationLevelSeparated',
    'individualPatternsSeparated',
    'stableDifferencesRequireRepeatedContexts',
    'independentTraitMeasurementRequired',
  ])
    if (individual[field] !== true)
      fail('INVALID_SHAPE', `protocol.individualDifferences.${field} must be true.`);
  if (individual.emoraTraitAccuracyClaim !== 'NONE')
    fail('FORBIDDEN_SCOPE', 'EMORA trait accuracy claims are forbidden.');
  return validateState(individual, 'protocol.individualDifferences');
}

function validateFalsifiability(value: unknown): void {
  const outcomes = new Set<string>();
  for (const [index, item] of array(value, 'protocol.falsifiabilityConditions').entries()) {
    const path = `protocol.falsifiabilityConditions[${index}]`;
    const condition = record(item, path);
    knownFields(
      condition,
      ['outcome', 'condition', 'governanceBoundary', 'automaticDecision'],
      path,
    );
    const outcome = oneOf(
      condition.outcome,
      FALSIFIABILITY_OUTCOMES,
      `${path}.outcome`,
    );
    if (outcomes.has(outcome))
      fail('INVALID_GOVERNANCE_REQUIREMENT', `${path} duplicates ${outcome}.`);
    outcomes.add(outcome);
    operationalText(condition.condition, `${path}.condition`);
    operationalText(
      condition.governanceBoundary,
      `${path}.governanceBoundary`,
    );
    if (condition.automaticDecision !== false)
      fail('FORBIDDEN_SCOPE', `${path}.automaticDecision must be false.`);
  }
  if (outcomes.size !== FALSIFIABILITY_OUTCOMES.length)
    fail(
      'INVALID_GOVERNANCE_REQUIREMENT',
      'Every falsifiability outcome must be represented.',
    );
}

function validateGovernedList(
  value: unknown,
  path: string,
  requiredFields: readonly string[],
  expected: readonly string[],
): HumanProtocolStatus {
  const definition = record(value, path);
  knownFields(
    definition,
    ['status', 'description', 'unresolvedReason', ...requiredFields],
    path,
  );
  const status = validateState(definition, path);
  uniqueExactSet(definition[requiredFields[0]!], expected, `${path}.${requiredFields[0]}`);
  return status;
}

function validateUnresolvedItems(value: unknown): HumanProtocolStatus[] {
  const statuses: HumanProtocolStatus[] = [];
  const ids = new Set<string>();
  for (const [index, item] of array(value, 'protocol.unresolvedItems').entries()) {
    const path = `protocol.unresolvedItems[${index}]`;
    const unresolved = record(item, path);
    knownFields(unresolved, ['itemId', 'domain', 'status', 'reason'], path);
    const id = text(unresolved.itemId, `${path}.itemId`);
    if (ids.has(id)) fail('INVALID_SHAPE', `${path} duplicates ${id}.`);
    ids.add(id);
    oneOf(
      unresolved.domain,
      [
        'CONSTRUCT_MAPPING',
        'MEASUREMENT',
        'CRITERION',
        'BASELINE',
        'TEMPORAL_DESIGN',
        'INDIVIDUAL_DIFFERENCES',
        'POPULATION',
        'PARTITIONING',
        'ETHICS_GOVERNANCE',
      ],
      `${path}.domain`,
    );
    statuses.push(
      oneOf(
        unresolved.status,
        ['UNRESOLVED', 'NOT_EVALUABLE'],
        `${path}.status`,
      ),
    );
    text(unresolved.reason, `${path}.reason`);
  }
  return statuses;
}

function validateProtocol(input: HumanBehavioralEvaluationProtocolInput): void {
  const root = record(input, 'protocol');
  knownFields(root, ROOT_FIELDS, 'protocol');
  text(root.protocolId, 'protocol.protocolId');
  text(root.protocolVersion, 'protocol.protocolVersion');
  text(root.methodologyVersion, 'protocol.methodologyVersion');
  if (typeof root.issuedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(root.issuedDate))
    fail('INVALID_SHAPE', 'protocol.issuedDate must be YYYY-MM-DD.');
  const protocolStatus = oneOf(
    root.status,
    HUMAN_PROTOCOL_STATUSES,
    'protocol.status',
  );

  validateScope(root.scope);
  const scope = root.scope as HumanBehavioralEvaluationProtocolInput['scope'];
  const populationStatus = validatePopulation(root.population);
  const mappingStateList = validateMappings(
    root.constructMappings,
    scope.targetOutputs,
  );
  const mappingStatuses = new Map<string, HumanProtocolStatus>();
  for (const mapping of array(
    root.constructMappings,
    'protocol.constructMappings',
  ) as unknown as HumanBehavioralEvaluationProtocolInput['constructMappings'])
    mappingStatuses.set(mapping.mappingId, mapping.status);
  const statuses: HumanProtocolStatus[] = [
    populationStatus,
    ...validateObservationSchema(root.observationSchema),
    ...mappingStateList,
  ];
  const criterionStatuses = validateCriteria(
    root.descriptiveCriteria,
    mappingStatuses,
  );
  const baselineStatuses = validateBaselines(root.baselines);
  const temporalStatus = validateTemporal(root.temporalEvaluation);
  const individualStatus = validateIndividualDifferences(
    root.individualDifferences,
  );
  const partitionStatus = validatePartitioning(root.partitioning);
  statuses.push(...criterionStatuses);
  statuses.push(...baselineStatuses);
  statuses.push(temporalStatus);
  statuses.push(individualStatus);
  statuses.push(partitionStatus);
  uniqueExactSet(root.leakageControls, LEAKAGE_CONTROLS, 'protocol.leakageControls');
  validateFalsifiability(root.falsifiabilityConditions);
  statuses.push(
    validateGovernedList(
      root.reproducibility,
      'protocol.reproducibility',
      ['requiredFields'],
      REQUIRED_REPRODUCIBILITY_FIELDS,
    ),
  );
  statuses.push(
    validateGovernedList(
      root.ethicsGovernance,
      'protocol.ethicsGovernance',
      ['requirements'],
      ETHICS_GOVERNANCE_REQUIREMENTS,
    ),
  );
  uniqueExactSet(
    root.scientificBoundary,
    SCIENTIFIC_BOUNDARY_STATEMENTS,
    'protocol.scientificBoundary',
  );
  const unresolvedStatuses = validateUnresolvedItems(root.unresolvedItems);
  const unresolvedItems =
    root.unresolvedItems as HumanBehavioralEvaluationProtocolInput['unresolvedItems'];
  const hasUnresolved = (
    domain: HumanBehavioralEvaluationProtocolInput['unresolvedItems'][number]['domain'],
    status: Exclude<HumanProtocolStatus, 'DEFINED'>,
  ) =>
    unresolvedItems.some(
      (item) => item.domain === domain && item.status === status,
    );
  const requireTrackedState = (
    status: HumanProtocolStatus,
    domains: readonly HumanBehavioralEvaluationProtocolInput['unresolvedItems'][number]['domain'][],
    label: string,
  ) => {
    if (
      status !== 'DEFINED' &&
      !domains.some((domain) => hasUnresolved(domain, status))
    )
      fail(
        'INVALID_STATUS_CONFIGURATION',
        `${label} ${status} state requires a matching unresolved item.`,
      );
  };
  requireTrackedState(populationStatus, ['POPULATION'], 'Population');
  requireTrackedState(partitionStatus, ['PARTITIONING'], 'Partitioning');
  requireTrackedState(baselineStatuses[0]!, ['BASELINE'], 'Baselines');
  requireTrackedState(temporalStatus, ['TEMPORAL_DESIGN'], 'Temporal design');
  requireTrackedState(
    individualStatus,
    ['INDIVIDUAL_DIFFERENCES'],
    'Individual differences',
  );
  if (mappingStateList.includes('UNRESOLVED'))
    requireTrackedState(
      'UNRESOLVED',
      ['CONSTRUCT_MAPPING', 'MEASUREMENT'],
      'Construct mappings',
    );
  if (mappingStateList.includes('NOT_EVALUABLE'))
    requireTrackedState(
      'NOT_EVALUABLE',
      ['CONSTRUCT_MAPPING'],
      'Construct mappings',
    );
  if (criterionStatuses.includes('UNRESOLVED'))
    requireTrackedState('UNRESOLVED', ['CRITERION'], 'Criteria');
  if (criterionStatuses.includes('NOT_EVALUABLE'))
    requireTrackedState('NOT_EVALUABLE', ['CRITERION'], 'Criteria');
  if (baselineStatuses.includes('NOT_EVALUABLE'))
    requireTrackedState('NOT_EVALUABLE', ['BASELINE'], 'Baselines');

  if (protocolStatus === 'DEFINED' && (statuses.some((status) => status !== 'DEFINED') || unresolvedStatuses.length > 0))
    fail(
      'INVALID_STATUS_CONFIGURATION',
      'A DEFINED protocol cannot contain unresolved or non-evaluable configuration.',
    );
  if (
    protocolStatus === 'UNRESOLVED' &&
    (!statuses.includes('UNRESOLVED') || !unresolvedStatuses.includes('UNRESOLVED'))
  )
    fail(
      'INVALID_STATUS_CONFIGURATION',
      'An UNRESOLVED protocol must identify unresolved governed configuration.',
    );
  if (
    protocolStatus === 'NOT_EVALUABLE' &&
    (!statuses.includes('NOT_EVALUABLE') ||
      !unresolvedStatuses.includes('NOT_EVALUABLE'))
  )
    fail(
      'INVALID_STATUS_CONFIGURATION',
      'A NOT_EVALUABLE protocol must identify a non-evaluable configuration and reason.',
    );
}

export function createHumanBehavioralEvaluationProtocol(
  input: HumanBehavioralEvaluationProtocolInput,
): HumanBehavioralEvaluationProtocol {
  const content = snapshot(input, 'protocol');
  validateProtocol(content);
  const governed = {
    ...content,
    scopeKind: 'HUMAN_METHODOLOGY_ONLY' as const,
    execution: 'NOT_IMPLEMENTED' as const,
    humanData: 'NONE' as const,
  };
  return freeze({ ...governed, protocolHash: hashCanonical(governed) });
}
