import { hashCanonical } from '../canonicalize';
import { classifyDimension } from '../dimensions/registry';
import { HUMAN_MISSINGNESS_STATES } from '../human-methodology/contracts';
import { EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0 } from '../human-methodology/protocol';
import {
  D09_ACTIVE_METRICS,
  D09_AUTHORITATIVE_CONTRACT_ID,
  D09_CONTRACT_VERSION,
  D09_PROPOSABLE_DIMENSIONS,
  D09_EMORA_OUTPUT_STATUSES,
  D09_INACTIVE_METRICS,
  D09_OBSERVATION_STRUCTURES,
  D09_SCALE_DIRECTIONS,
  D09_SCALE_TYPES,
  D09_SCIENTIFIC_BOUNDARIES,
  D09_TEMPORAL_RELATIONSHIPS,
} from './contracts';
import type {
  D09DatasetArtifact,
  D09DescriptiveEvaluationContract,
  D09DescriptiveEvaluationContractInput,
  D09DimensionCriterion,
  D09EvaluationReport,
  D09GovernedHumanDataset,
  D09GovernedHumanDatasetInput,
  D09NonExecutableReport,
  D09Observation,
  D09ReportingBoundary,
  D09UnitTestFixture,
  D09UnitTestFixtureInput,
} from './contracts';

export type D09Violation =
  | 'INVALID_SHAPE'
  | 'UNKNOWN_FIELD'
  | 'INVALID_ENUM'
  | 'INVALID_CONTRACT'
  | 'UNAUTHORIZED_CONTRACT'
  | 'INVALID_CRITERION'
  | 'INVALID_DATASET'
  | 'INVALID_OBSERVATION'
  | 'DUPLICATE_OBSERVATION'
  | 'DATASET_HASH_MISMATCH'
  | 'PHASE_6_15_UNRESOLVED'
  | 'UNSUPPORTED_OBSERVATION_POOLING';

export class D09ValidationError extends Error {
  readonly violation: D09Violation;

  constructor(violation: D09Violation, message: string) {
    super(message);
    this.name = 'D09ValidationError';
    this.violation = violation;
  }
}

const SHA256 = /^[0-9a-f]{64}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function fail(violation: D09Violation, message: string): never {
  throw new D09ValidationError(violation, message);
}

function snapshot<T>(value: T, path: string, active = new WeakSet<object>()): T {
  if (typeof value !== 'object' || value === null) return value;
  if (active.has(value)) fail('INVALID_SHAPE', `${path} must not be circular.`);
  active.add(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype)
      fail('INVALID_SHAPE', `${path} must be a plain array.`);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol')
        fail('INVALID_SHAPE', `${path} must not contain symbol properties.`);
      if (key !== 'length') {
        const index = Number(key);
        if (!Number.isSafeInteger(index) || index < 0 || index >= value.length || String(index) !== key)
          fail('INVALID_SHAPE', `${path}.${key} is not an array index.`);
      }
    }
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
        fail('INVALID_SHAPE', `${path}[${index}] must be an enumerable data property.`);
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
      fail('INVALID_SHAPE', `${path}.${key} must be an enumerable data property.`);
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
    for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested);
  }
  return value;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail('INVALID_SHAPE', `${path} must be an object.`);
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail('INVALID_SHAPE', `${path} must be an array.`);
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    fail('INVALID_SHAPE', `${path} must be a non-empty string.`);
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail('INVALID_OBSERVATION', `${path} must be finite.`);
  return value;
}

function knownFields(value: Record<string, unknown>, fields: readonly string[], path: string): void {
  for (const key of Object.keys(value))
    if (!fields.includes(key)) fail('UNKNOWN_FIELD', `${path}.${key} is not recognised.`);
}

function oneOf<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !values.includes(value as T))
    fail('INVALID_ENUM', `${path} has an invalid value.`);
  return value as T;
}

function exactVocabulary(value: unknown, expected: readonly string[], path: string): void {
  const values = array(value, path);
  if (
    values.length !== expected.length ||
    new Set(values).size !== values.length ||
    values.some((item) => typeof item !== 'string') ||
    expected.some((item) => !values.includes(item))
  ) fail('INVALID_CONTRACT', `${path} must contain the frozen vocabulary exactly once.`);
}

function stringArray(value: unknown, path: string): readonly string[] {
  const values = array(value, path);
  values.forEach((item, index) => text(item, `${path}[${index}]`));
  return values as readonly string[];
}

function validateCriterion(value: unknown, index: number): D09DimensionCriterion {
  const path = `contract.criteria[${index}]`;
  const criterion = record(value, path);
  knownFields(criterion, [
    'criterionId', 'dimension', 'humanConstruct', 'constructMappingReference',
    'instrument', 'transformation', 'temporalRelationship', 'observationStructure',
    'pairEligibilityRule', 'exclusions', 'partialResponseRule', 'limitations',
  ], path);
  text(criterion.criterionId, `${path}.criterionId`);
  const dimension = text(criterion.dimension, `${path}.dimension`);
  if (!D09_PROPOSABLE_DIMENSIONS.includes(dimension as never))
    fail('INVALID_CRITERION', `${path}.dimension has no currently evaluable Phase 6.15 mapping.`);
  text(criterion.humanConstruct, `${path}.humanConstruct`);
  text(criterion.constructMappingReference, `${path}.constructMappingReference`);

  const instrument = record(criterion.instrument, `${path}.instrument`);
  knownFields(instrument, [
    'methodId', 'methodVersion', 'language', 'measurementUnit', 'scaleType',
    'scaleDirection', 'pearsonEligibility', 'scaleInterpretationJustification',
  ], `${path}.instrument`);
  text(instrument.methodId, `${path}.instrument.methodId`);
  text(instrument.methodVersion, `${path}.instrument.methodVersion`);
  text(instrument.language, `${path}.instrument.language`);
  text(instrument.measurementUnit, `${path}.instrument.measurementUnit`);
  oneOf(instrument.scaleType, D09_SCALE_TYPES, `${path}.instrument.scaleType`);
  oneOf(instrument.scaleDirection, D09_SCALE_DIRECTIONS, `${path}.instrument.scaleDirection`);
  if (instrument.pearsonEligibility !== 'PREDEFINED_AND_JUSTIFIED')
    fail('INVALID_CRITERION', `${path}.instrument requires predefined Pearson eligibility.`);
  text(instrument.scaleInterpretationJustification, `${path}.instrument.scaleInterpretationJustification`);

  const transformation = record(criterion.transformation, `${path}.transformation`);
  knownFields(transformation, ['kind', 'rationale', 'resultIndependent', 'frozenBeforeResults'], `${path}.transformation`);
  if (
    transformation.kind !== 'IDENTITY' ||
    transformation.resultIndependent !== true ||
    transformation.frozenBeforeResults !== true
  ) fail('INVALID_CRITERION', `${path}.transformation must be frozen, result-independent IDENTITY.`);
  text(transformation.rationale, `${path}.transformation.rationale`);

  oneOf(criterion.temporalRelationship, D09_TEMPORAL_RELATIONSHIPS, `${path}.temporalRelationship`);
  oneOf(criterion.observationStructure, D09_OBSERVATION_STRUCTURES, `${path}.observationStructure`);
  if (criterion.pairEligibilityRule !== 'EXPLICIT_STATUS_PAIRING_ONLY')
    fail('INVALID_CRITERION', `${path}.pairEligibilityRule must be frozen before results.`);
  if (criterion.exclusions !== 'NONE_CONFIGURED')
    fail('INVALID_CRITERION', `${path}.exclusions has no executable D09 configuration.`);
  if (criterion.partialResponseRule !== 'NOT_CONFIGURED')
    fail('INVALID_CRITERION', `${path}.partialResponseRule has no executable D09 configuration.`);
  stringArray(criterion.limitations, `${path}.limitations`);
  return criterion as unknown as D09DimensionCriterion;
}

function validateContract(input: D09DescriptiveEvaluationContractInput): void {
  const root = record(input, 'contract');
  knownFields(root, [
    'contractId', 'contractVersion', 'objective', 'phase615ProtocolReference',
    'activeMetrics', 'inactiveMetrics', 'criteria', 'missingnessStates',
    'participantAggregation', 'repeatedMeasuresMethodology',
    'temporalDynamicsMethodology', 'thresholds', 'baselines', 'dataCollection',
    'currentHumanDataset', 'metricFormulaIdentity', 'denominatorDefinition',
    'observationScopeRule', 'scientificBoundaries',
  ], 'contract');
  text(root.contractId, 'contract.contractId');
  if (root.contractVersion !== D09_CONTRACT_VERSION)
    fail('INVALID_CONTRACT', 'Unsupported D09 contract version.');
  if (root.objective !== 'Evaluate descriptive correspondence/association between EMORA computational outputs and predefined human-observable indicators.')
    fail('INVALID_CONTRACT', 'D09 objective is frozen.');
  exactVocabulary(root.activeMetrics, D09_ACTIVE_METRICS, 'contract.activeMetrics');
  exactVocabulary(root.inactiveMetrics, D09_INACTIVE_METRICS, 'contract.inactiveMetrics');
  exactVocabulary(root.missingnessStates, HUMAN_MISSINGNESS_STATES, 'contract.missingnessStates');
  exactVocabulary(root.scientificBoundaries, D09_SCIENTIFIC_BOUNDARIES, 'contract.scientificBoundaries');

  const phase615 = record(root.phase615ProtocolReference, 'contract.phase615ProtocolReference');
  knownFields(phase615, ['protocolVersion', 'methodologyVersion', 'protocolHash', 'status'], 'contract.phase615ProtocolReference');
  if (
    phase615.protocolVersion !== EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolVersion ||
    phase615.methodologyVersion !== EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.methodologyVersion ||
    phase615.protocolHash !== EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolHash ||
    phase615.status !== 'UNRESOLVED'
  ) fail('INVALID_CONTRACT', 'D09 must reference the unchanged canonical Phase 6.15 protocol.');

  if (
    root.participantAggregation !== 'DEFERRED' ||
    root.repeatedMeasuresMethodology !== 'DEFERRED' ||
    root.temporalDynamicsMethodology !== 'DEFERRED' ||
    root.thresholds !== 'NOT_IMPLEMENTED' ||
    root.baselines !== 'NOT_IMPLEMENTED' ||
    root.dataCollection !== 'NOT_AUTHORIZED' ||
    !['NONE', 'GOVERNED_DATASET_REQUIRED'].includes(String(root.currentHumanDataset)) ||
    root.metricFormulaIdentity !== 'PHASE_6_11_CALCULATE_PEARSON_PRODUCT_MOMENT' ||
    root.denominatorDefinition !== 'NOT_EVALUABLE_PHASE_6_15_UNRESOLVED' ||
    root.observationScopeRule !== 'SINGLE_PARTICIPANT_STUDY_SESSION_SEQUENCE_CONTEXT_ONLY'
  ) fail('INVALID_CONTRACT', 'D09 cannot activate unresolved methodology.');

  const criterionIds = new Set<string>();
  const criteria = array(root.criteria, 'contract.criteria');
  if (
    (criteria.length === 0 && root.currentHumanDataset !== 'NONE') ||
    (criteria.length > 0 && root.currentHumanDataset !== 'GOVERNED_DATASET_REQUIRED')
  ) fail('INVALID_CONTRACT', 'D09 data availability must match whether proposed criteria exist.');
  for (const [index, item] of criteria.entries()) {
    const criterion = validateCriterion(item, index);
    if (criterionIds.has(criterion.criterionId))
      fail('INVALID_CRITERION', `Duplicate criterion ${criterion.criterionId}.`);
    criterionIds.add(criterion.criterionId);
  }
}

export function createD09Contract(
  input: D09DescriptiveEvaluationContractInput,
): D09DescriptiveEvaluationContract {
  const content = snapshot(input, 'contract');
  validateContract(content);
  const governed = {
    ...content,
    scopeKind: 'D09_DESCRIPTIVE_CRITERIA' as const,
    executionState: content.criteria.length === 0
      ? 'NOT_EXECUTABLE_NO_HUMAN_DATA' as const
      : 'NOT_EXECUTABLE_PHASE_6_15_UNRESOLVED' as const,
  };
  return freeze({ ...governed, contractHash: hashCanonical(governed) });
}

export const D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0 = createD09Contract({
    contractId: D09_AUTHORITATIVE_CONTRACT_ID,
    contractVersion: D09_CONTRACT_VERSION,
    objective: 'Evaluate descriptive correspondence/association between EMORA computational outputs and predefined human-observable indicators.',
    phase615ProtocolReference: {
      protocolVersion: EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolVersion as '1.0.0',
      methodologyVersion: EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.methodologyVersion as 'phase-6.15-v1',
      protocolHash: EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolHash,
      status: 'UNRESOLVED',
    },
    activeMetrics: [...D09_ACTIVE_METRICS],
    inactiveMetrics: [...D09_INACTIVE_METRICS],
    criteria: [],
    missingnessStates: [...HUMAN_MISSINGNESS_STATES],
    participantAggregation: 'DEFERRED',
    repeatedMeasuresMethodology: 'DEFERRED',
    temporalDynamicsMethodology: 'DEFERRED',
    thresholds: 'NOT_IMPLEMENTED',
    baselines: 'NOT_IMPLEMENTED',
    dataCollection: 'NOT_AUTHORIZED',
    currentHumanDataset: 'NONE',
    metricFormulaIdentity: 'PHASE_6_11_CALCULATE_PEARSON_PRODUCT_MOMENT',
    denominatorDefinition: 'NOT_EVALUABLE_PHASE_6_15_UNRESOLVED',
    observationScopeRule: 'SINGLE_PARTICIPANT_STUDY_SESSION_SEQUENCE_CONTEXT_ONLY',
    scientificBoundaries: [...D09_SCIENTIFIC_BOUNDARIES],
});

function validateMeasurement(value: unknown, path: string, statuses: readonly string[]): void {
  const measurement = record(value, path);
  knownFields(measurement, ['status', 'value'], path);
  const status = oneOf(measurement.status, statuses, `${path}.status`);
  if (status === 'OBSERVED') finite(measurement.value, `${path}.value`);
  else if ('value' in measurement)
    fail('INVALID_OBSERVATION', `${path}.value is forbidden unless status is OBSERVED.`);
}

function validateObservation(value: unknown, index: number): D09Observation {
  const path = `dataset.observations[${index}]`;
  const observation = record(value, path);
  knownFields(observation, [
    'participantPseudonymousId', 'studyId', 'sessionId', 'observationId',
    'sequenceId', 'eventContext', 'timestamp', 'temporalRelationship',
    'observationStructure', 'dimension', 'constructMappingReference',
    'humanMeasurement', 'emoraOutput', 'deviation',
  ], path);
  for (const field of [
    'participantPseudonymousId', 'studyId', 'sessionId', 'observationId',
    'eventContext', 'constructMappingReference',
  ]) text(observation[field], `${path}.${field}`);
  if (observation.sequenceId !== undefined) text(observation.sequenceId, `${path}.sequenceId`);
  if (observation.deviation !== undefined) text(observation.deviation, `${path}.deviation`);
  const timestamp = text(observation.timestamp, `${path}.timestamp`);
  if (!ISO_TIMESTAMP.test(timestamp) || !Number.isFinite(Date.parse(timestamp)))
    fail('INVALID_OBSERVATION', `${path}.timestamp must be an ISO-8601 timestamp.`);
  oneOf(observation.temporalRelationship, D09_TEMPORAL_RELATIONSHIPS, `${path}.temporalRelationship`);
  oneOf(observation.observationStructure, D09_OBSERVATION_STRUCTURES, `${path}.observationStructure`);
  const dimension = text(observation.dimension, `${path}.dimension`);
  if (!D09_PROPOSABLE_DIMENSIONS.includes(dimension as never))
    fail('INVALID_OBSERVATION', `${path}.dimension has no currently evaluable Phase 6.15 mapping.`);
  validateMeasurement(observation.humanMeasurement, `${path}.humanMeasurement`, HUMAN_MISSINGNESS_STATES);
  validateMeasurement(observation.emoraOutput, `${path}.emoraOutput`, D09_EMORA_OUTPUT_STATUSES);
  const definition = classifyDimension(dimension)!;
  const emoraOutput = observation.emoraOutput as unknown as D09Observation['emoraOutput'];
  if (
    emoraOutput.status === 'OBSERVED' &&
    (emoraOutput.value! < definition.range[0] || emoraOutput.value! > definition.range[1])
  ) fail('INVALID_OBSERVATION', `${path}.emoraOutput.value is outside the governed dimension range.`);
  return observation as unknown as D09Observation;
}

function validateDataset(input: D09GovernedHumanDatasetInput | D09UnitTestFixtureInput): void {
  const root = record(input, 'dataset');
  knownFields(root, [
    'datasetId', 'datasetVersion', 'protocolId', 'protocolVersion', 'protocolHash',
    'emoraVersion', 'emoraCommit', 'configurationIdentity', 'observations', 'dataKind',
  ], 'dataset');
  for (const field of [
    'datasetId', 'datasetVersion', 'protocolId', 'protocolVersion', 'emoraVersion', 'emoraCommit',
  ]) text(root[field], `dataset.${field}`);
  const protocolHash = text(root.protocolHash, 'dataset.protocolHash');
  if (!SHA256.test(protocolHash)) fail('INVALID_DATASET', 'dataset.protocolHash must be SHA-256.');
  if (
    root.protocolId !== EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolId ||
    root.protocolVersion !== EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolVersion ||
    root.protocolHash !== EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolHash
  ) fail('INVALID_DATASET', 'Dataset protocol identity must match canonical Phase 6.15.');
  oneOf(root.dataKind, ['GOVERNED_HUMAN_OBSERVATIONS', 'D09_UNIT_TEST_FIXTURE'], 'dataset.dataKind');
  const configuration = record(root.configurationIdentity, 'dataset.configurationIdentity');
  if (configuration.status === 'PROVIDED') {
    knownFields(configuration, ['status', 'hash'], 'dataset.configurationIdentity');
    const hash = text(configuration.hash, 'dataset.configurationIdentity.hash');
    if (!SHA256.test(hash)) fail('INVALID_DATASET', 'Configuration hash must be SHA-256.');
  } else if (configuration.status === 'NOT_PROVIDED') {
    knownFields(configuration, ['status'], 'dataset.configurationIdentity');
  } else fail('INVALID_DATASET', 'Configuration identity status is invalid.');

  const observations = array(root.observations, 'dataset.observations');
  if (observations.length === 0)
    fail('INVALID_DATASET', 'A D09 dataset artifact must contain at least one observation.');
  const ids = new Set<string>();
  for (const [index, item] of observations.entries()) {
    const observation = validateObservation(item, index);
    if (ids.has(observation.observationId))
      fail('DUPLICATE_OBSERVATION', `Duplicate observation ${observation.observationId}.`);
    ids.add(observation.observationId);
  }
  assertSingleObservationScope({ observations: observations as unknown as readonly D09Observation[] });
}

export function createD09GovernedHumanDataset(
  input: D09GovernedHumanDatasetInput,
): D09GovernedHumanDataset {
  void input;
  fail(
    'PHASE_6_15_UNRESOLVED',
    'Governed human datasets cannot be created while Phase 6.15 is UNRESOLVED and data collection is not authorized.',
  );
}

export function createD09UnitTestFixture(
  input: D09UnitTestFixtureInput,
): D09UnitTestFixture {
  const content = snapshot(input, 'dataset');
  validateDataset(content);
  return freeze({ ...content, fixtureHash: hashCanonical(content) });
}

function verifyContractArtifact(value: D09DescriptiveEvaluationContract): D09DescriptiveEvaluationContract {
  const artifact = snapshot(value, 'contractArtifact');
  const root = record(artifact, 'contractArtifact');
  knownFields(root, [
    'contractId', 'contractVersion', 'objective', 'phase615ProtocolReference',
    'activeMetrics', 'inactiveMetrics', 'criteria', 'missingnessStates',
    'participantAggregation', 'repeatedMeasuresMethodology',
    'temporalDynamicsMethodology', 'thresholds', 'baselines', 'dataCollection',
    'currentHumanDataset', 'metricFormulaIdentity', 'denominatorDefinition',
    'observationScopeRule', 'scientificBoundaries', 'scopeKind', 'executionState',
    'contractHash',
  ], 'contractArtifact');
  if (
    artifact.scopeKind !== 'D09_DESCRIPTIVE_CRITERIA' ||
    !['NOT_EXECUTABLE_NO_HUMAN_DATA', 'NOT_EXECUTABLE_PHASE_6_15_UNRESOLVED'].includes(artifact.executionState) ||
    !SHA256.test(artifact.contractHash)
  ) fail('INVALID_CONTRACT', 'D09 contract artifact metadata is invalid.');
  const input = { ...artifact } as unknown as Record<string, unknown>;
  delete input.scopeKind;
  delete input.executionState;
  delete input.contractHash;
  const expected = createD09Contract(input as unknown as D09DescriptiveEvaluationContractInput);
  if (expected.contractHash !== artifact.contractHash)
    fail('INVALID_CONTRACT', 'D09 contract hash does not match its governed content.');
  if (expected.contractHash !== D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0.contractHash)
    fail('UNAUTHORIZED_CONTRACT', 'Only the implementation-owned authoritative D09 contract identity is accepted.');
  return D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0;
}

function verifyDatasetArtifact(value: D09DatasetArtifact): D09DatasetArtifact {
  const artifact = snapshot(value, 'datasetArtifact');
  const root = record(artifact, 'datasetArtifact');
  const hashField = artifact.dataKind === 'D09_UNIT_TEST_FIXTURE' ? 'fixtureHash' : 'datasetHash';
  knownFields(root, [
    'datasetId', 'datasetVersion', 'protocolId', 'protocolVersion', 'protocolHash',
    'emoraVersion', 'emoraCommit', 'configurationIdentity', 'observations', 'dataKind',
    hashField,
  ], 'datasetArtifact');
  const suppliedHash = text(root[hashField], `datasetArtifact.${hashField}`);
  if (!SHA256.test(suppliedHash)) fail('INVALID_DATASET', `${hashField} must be SHA-256.`);
  const input = { ...artifact } as unknown as Record<string, unknown>;
  delete input[hashField];
  validateDataset(input as unknown as D09GovernedHumanDatasetInput | D09UnitTestFixtureInput);
  if (hashCanonical(input) !== suppliedHash)
    fail('DATASET_HASH_MISMATCH', `${hashField} does not match canonical content.`);
  return freeze(artifact);
}

function assertSingleObservationScope(
  dataset: Readonly<{ readonly observations: readonly D09Observation[] }>,
): void {
  const [first, ...rest] = dataset.observations;
  if (!first) fail('INVALID_DATASET', 'A governed dataset must not be empty.');
  const mismatch = rest.some((observation) =>
    observation.participantPseudonymousId !== first.participantPseudonymousId ||
    observation.studyId !== first.studyId ||
    observation.sessionId !== first.sessionId ||
    observation.sequenceId !== first.sequenceId ||
    observation.eventContext !== first.eventContext);
  if (mismatch)
    fail(
      'UNSUPPORTED_OBSERVATION_POOLING',
      'D09 cannot pool participants, studies, sessions, sequences, or contexts while aggregation methodology is deferred.',
    );
}

const REPORTING_BOUNDARY: D09ReportingBoundary = freeze({
  metric: 'PEARSON_R',
  formulaIdentity: 'PHASE_6_11_CALCULATE_PEARSON_PRODUCT_MOMENT',
  interpretation: 'DESCRIPTIVE_LINEAR_ASSOCIATION_ONLY',
  exclusionsState: 'NONE_CONFIGURED',
  partialResponseState: 'NOT_CONFIGURED',
  denominatorDefinition: 'NOT_EVALUABLE_PHASE_6_15_UNRESOLVED',
  missingnessStates: [...HUMAN_MISSINGNESS_STATES],
  participantAggregation: 'DEFERRED',
  repeatedMeasuresMethodology: 'DEFERRED',
  temporalDynamicsMethodology: 'DEFERRED',
  provenanceState: 'NOT_APPLICABLE_NO_EXECUTION',
});

function nonExecutableReport(
  contract: D09DescriptiveEvaluationContract,
  status: D09NonExecutableReport['status'],
  reason: D09NonExecutableReport['reason'],
): D09EvaluationReport {
  const content = {
    status,
    contractId: contract.contractId,
    contractVersion: contract.contractVersion,
    contractHash: contract.contractHash,
    activeMetrics: contract.activeMetrics,
    scientificBoundaries: contract.scientificBoundaries,
    reportingBoundary: REPORTING_BOUNDARY,
    reason,
  };
  return freeze({ ...content, reportHash: hashCanonical(content) });
}

export function evaluateD09(
  contract: D09DescriptiveEvaluationContract,
  dataset?: D09DatasetArtifact,
): D09EvaluationReport {
  const authoritativeContract = verifyContractArtifact(contract);
  if (dataset === undefined) {
    return nonExecutableReport(
      authoritativeContract,
      'NOT_EXECUTABLE_NO_HUMAN_DATA',
      'No governed human dataset was supplied; no human result was generated.',
    );
  }

  const governedDataset = verifyDatasetArtifact(dataset);
  if (governedDataset.dataKind === 'D09_UNIT_TEST_FIXTURE') {
    return nonExecutableReport(
      authoritativeContract,
      'NOT_EXECUTABLE_TEST_FIXTURE',
      'D09 unit-test fixtures are non-human and cannot produce human evaluation results.',
    );
  }

  assertSingleObservationScope(governedDataset);
  return nonExecutableReport(
    authoritativeContract,
    'NOT_EXECUTABLE_PHASE_6_15_UNRESOLVED',
    'Phase 6.15 remains UNRESOLVED with execution NOT_IMPLEMENTED and humanData NONE; D09 produced no human result.',
  );
}
