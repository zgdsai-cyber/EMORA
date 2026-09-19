import { describe, expect, it } from 'vitest';

import { hashCanonical } from '../canonicalize';
import { EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0 } from '../human-methodology/protocol';
import { calculatePearson } from '../metrics/calculations';
import {
  D09_ACTIVE_METRICS,
  D09_CONTRACT_VERSION,
  D09_EXECUTABLE_DIMENSIONS,
  D09_PROPOSABLE_DIMENSIONS,
  D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0,
  D09_INACTIVE_METRICS,
  D09ValidationError,
  createD09Contract,
  createD09GovernedHumanDataset,
  createD09UnitTestFixture,
  evaluateD09,
} from './index';
import type {
  D09DescriptiveEvaluationContract,
  D09DescriptiveEvaluationContractInput,
  D09DimensionCriterion,
  D09GovernedHumanDatasetInput,
  D09Observation,
  D09UnitTestFixtureInput,
} from './index';

const SHA = 'a'.repeat(64);

function criterion(
  dimension: D09DimensionCriterion['dimension'] = 'joy',
): D09DimensionCriterion {
  return {
    criterionId: `criterion-${dimension}`,
    dimension,
    humanConstruct: `Predefined observable indicator for ${dimension}`,
    constructMappingReference: `proposed-mapping-${dimension}-v1`,
    instrument: {
      methodId: `instrument-${dimension}`,
      methodVersion: '1.0.0',
      language: 'en',
      measurementUnit: 'declared-unit',
      scaleType: 'INTERVAL',
      scaleDirection: 'HIGHER_MEANS_MORE',
      pearsonEligibility: 'PREDEFINED_AND_JUSTIFIED',
      scaleInterpretationJustification:
        'Proposed interval interpretation; it is not authoritative while Phase 6.15 remains unresolved.',
    },
    transformation: {
      kind: 'IDENTITY',
      rationale: 'No transformation or rescaling is applied.',
      resultIndependent: true,
      frozenBeforeResults: true,
    },
    temporalRelationship: 'CONTEMPORANEOUS',
    observationStructure: 'SINGLE_OBSERVATION',
    pairEligibilityRule: 'EXPLICIT_STATUS_PAIRING_ONLY',
    exclusions: 'NONE_CONFIGURED',
    partialResponseRule: 'NOT_CONFIGURED',
    limitations: ['Proposed criterion only; not approved for execution.'],
  };
}

function contractInput(
  criteria: readonly D09DimensionCriterion[] = [criterion()],
): D09DescriptiveEvaluationContractInput {
  const artifact = structuredClone(
    D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0,
  ) as unknown as Record<string, unknown>;
  delete artifact.contractHash;
  delete artifact.scopeKind;
  delete artifact.executionState;
  artifact.criteria = criteria;
  artifact.currentHumanDataset = criteria.length === 0
    ? 'NONE'
    : 'GOVERNED_DATASET_REQUIRED';
  return artifact as unknown as D09DescriptiveEvaluationContractInput;
}

function proposedContract(
  criteria: readonly D09DimensionCriterion[] = [criterion()],
): D09DescriptiveEvaluationContract {
  return createD09Contract(contractInput(criteria));
}

function observation(
  observationId: string,
  overrides: Partial<D09Observation> = {},
): D09Observation {
  return {
    participantPseudonymousId: 'unit-participant',
    studyId: 'unit-study',
    sessionId: 'unit-session',
    observationId,
    sequenceId: 'unit-sequence',
    eventContext: 'Synthetic unit-test fixture; never governed human data.',
    timestamp: `2026-01-${String(Number(observationId.replace(/\D/g, '')) + 1).padStart(2, '0')}T12:00:00.000Z`,
    temporalRelationship: 'CONTEMPORANEOUS',
    observationStructure: 'SINGLE_OBSERVATION',
    dimension: 'joy',
    constructMappingReference: 'proposed-mapping-joy-v1',
    humanMeasurement: { status: 'OBSERVED', value: 0.5 },
    emoraOutput: { status: 'OBSERVED', value: 0.5 },
    ...overrides,
  };
}

function datasetBase(observations: readonly D09Observation[]) {
  return {
    datasetId: 'unit-test-only-d09-fixture',
    datasetVersion: '1.0.0',
    protocolId: EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolId,
    protocolVersion: EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolVersion,
    protocolHash: EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0.protocolHash,
    emoraVersion: 'unit-test-version',
    emoraCommit: 'unit-test-commit',
    configurationIdentity: { status: 'PROVIDED' as const, hash: SHA },
    observations,
  };
}

function fixtureInput(
  observations: readonly D09Observation[],
): D09UnitTestFixtureInput {
  return { ...datasetBase(observations), dataKind: 'D09_UNIT_TEST_FIXTURE' };
}

function violationOf(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return error instanceof D09ValidationError ? error.violation : undefined;
  }
}

function validlyRehashContract(
  mutate: (artifact: Record<string, unknown>) => void,
): D09DescriptiveEvaluationContract {
  const artifact = structuredClone(
    D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0,
  ) as unknown as Record<string, unknown>;
  delete artifact.contractHash;
  mutate(artifact);
  return {
    ...artifact,
    contractHash: hashCanonical(artifact),
  } as unknown as D09DescriptiveEvaluationContract;
}

describe('Phase 6.16 D09 governance Fix Gate', () => {
  it('publishes only the versioned, hashed, immutable canonical no-data contract', () => {
    const artifact = D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0;
    expect(artifact.contractVersion).toBe(D09_CONTRACT_VERSION);
    expect(artifact.criteria).toEqual([]);
    expect(artifact.executionState).toBe('NOT_EXECUTABLE_NO_HUMAN_DATA');
    expect(artifact.currentHumanDataset).toBe('NONE');
    expect(artifact.dataCollection).toBe('NOT_AUTHORIZED');
    expect(artifact.contractHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.isFrozen(artifact.activeMetrics)).toBe(true);
  });

  it('allows exactly Pearson, distributions, and coverage/missingness', () => {
    expect(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0.activeMetrics)
      .toEqual(D09_ACTIVE_METRICS);
    expect(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0.inactiveMetrics)
      .toEqual(D09_INACTIVE_METRICS);
    expect(D09_ACTIVE_METRICS).toEqual([
      'PEARSON_R',
      'DESCRIPTIVE_DISTRIBUTIONS',
      'COVERAGE_MISSINGNESS',
    ]);
  });

  it('freezes exported vocabularies so runtime mutation cannot redefine authority', () => {
    const hash = D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0.contractHash;
    expect(Object.isFrozen(D09_ACTIVE_METRICS)).toBe(true);
    expect(Object.isFrozen(D09_INACTIVE_METRICS)).toBe(true);
    expect(Object.isFrozen(D09_PROPOSABLE_DIMENSIONS)).toBe(true);
    expect(() => {
      (D09_ACTIVE_METRICS as unknown as string[]).push('MAE');
    }).toThrow(TypeError);
    expect(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0.contractHash).toBe(hash);
    expect(evaluateD09(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0).status)
      .toBe('NOT_EXECUTABLE_NO_HUMAN_DATA');
  });

  it('references the existing Phase 6.11 Pearson formula without duplicating it', () => {
    expect(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0.metricFormulaIdentity)
      .toBe('PHASE_6_11_CALCULATE_PEARSON_PRODUCT_MOMENT');
    expect(calculatePearson([0.1, 0.9], [0.2, 1], 'joy')).toMatchObject({
      metricId: 'PEARSON_R',
      status: 'COMPUTED',
      value: 1,
    });
  });

  it('preserves Phase 6.15 UNRESOLVED, NOT_IMPLEMENTED, and humanData NONE', () => {
    const before = structuredClone(EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0);
    expect(before).toMatchObject({
      status: 'UNRESOLVED',
      execution: 'NOT_IMPLEMENTED',
      humanData: 'NONE',
    });
    evaluateD09(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0);
    expect(EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0).toEqual(before);
  });

  it('returns a complete governed no-data report without human results', () => {
    const report = evaluateD09(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0);
    expect(report).toMatchObject({
      status: 'NOT_EXECUTABLE_NO_HUMAN_DATA',
      reportingBoundary: {
        metric: 'PEARSON_R',
        formulaIdentity: 'PHASE_6_11_CALCULATE_PEARSON_PRODUCT_MOMENT',
        exclusionsState: 'NONE_CONFIGURED',
        partialResponseState: 'NOT_CONFIGURED',
        denominatorDefinition: 'NOT_EVALUABLE_PHASE_6_15_UNRESOLVED',
        participantAggregation: 'DEFERRED',
        repeatedMeasuresMethodology: 'DEFERRED',
        provenanceState: 'NOT_APPLICABLE_NO_EXECUTION',
      },
    });
    expect('dimensionResults' in report).toBe(false);
    expect('automaticModelChange' in report).toBe(false);
  });

  it('marks a criteria-bearing proposal non-executable and rejects it at execution', () => {
    const proposal = proposedContract();
    expect(proposal.executionState).toBe('NOT_EXECUTABLE_PHASE_6_15_UNRESOLVED');
    expect(violationOf(() => evaluateD09(proposal))).toBe('UNAUTHORIZED_CONTRACT');
  });

  it('rejects a hash-valid caller mapping as non-authoritative', () => {
    const proposal = proposedContract([{ ...criterion(), constructMappingReference: 'caller-self-approved' }]);
    expect(proposal.contractHash).toMatch(/^[0-9a-f]{64}$/);
    expect(violationOf(() => evaluateD09(proposal))).toBe('UNAUTHORIZED_CONTRACT');
  });

  it('rejects hash-valid altered criteria as non-authoritative', () => {
    const proposal = proposedContract([criterion('fear')]);
    expect(violationOf(() => evaluateD09(proposal))).toBe('UNAUTHORIZED_CONTRACT');
  });

  it('rejects a hash-valid altered scale interpretation as non-authoritative', () => {
    const changed = criterion();
    const proposal = proposedContract([{
      ...changed,
      instrument: {
        ...changed.instrument,
        scaleInterpretationJustification: 'Different caller-authored interpretation.',
      },
    }]);
    expect(violationOf(() => evaluateD09(proposal))).toBe('UNAUTHORIZED_CONTRACT');
  });

  it('rejects even a validly rehashed artifact with altered active metrics', () => {
    const forged = validlyRehashContract((artifact) => {
      artifact.activeMetrics = [...D09_ACTIVE_METRICS, 'MAE'];
    });
    expect(violationOf(() => evaluateD09(forged))).toBe('INVALID_CONTRACT');
  });

  it('rejects a tampered authoritative artifact after hash creation', () => {
    const forged = {
      ...D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0,
      scientificBoundaries: ['Caller replaced the boundaries.'],
    } as unknown as D09DescriptiveEvaluationContract;
    expect(violationOf(() => evaluateD09(forged))).toBe('INVALID_CONTRACT');
  });

  it('prevents creation of governed human datasets while collection is unauthorized', () => {
    expect(violationOf(() => createD09GovernedHumanDataset(
      {} as D09GovernedHumanDatasetInput,
    ))).toBe('PHASE_6_15_UNRESOLVED');
  });

  it('distinguishes unit-test fixtures and prevents human evaluation results', () => {
    const fixture = createD09UnitTestFixture(fixtureInput([observation('01')]));
    expect(fixture.dataKind).toBe('D09_UNIT_TEST_FIXTURE');
    expect('datasetHash' in fixture).toBe(false);
    const report = evaluateD09(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0, fixture);
    expect(report.status).toBe('NOT_EXECUTABLE_TEST_FIXTURE');
    expect('dimensionResults' in report).toBe(false);
  });

  it.each(['intensity', 'confidence', 'confidenceAdjustment'] as const)(
    'rejects the non-evaluable or computational-only %s dimension',
    (dimension) => {
      const invalid = { ...criterion(), dimension } as unknown as D09DimensionCriterion;
      expect(violationOf(() => createD09Contract(contractInput([invalid]))))
        .toBe('INVALID_CRITERION');
    },
  );

  it('keeps seven emotions plus valence and arousal independently addressable as proposals', () => {
    expect(D09_EXECUTABLE_DIMENSIONS).toEqual([]);
    expect(D09_PROPOSABLE_DIMENSIONS).toEqual([
      'love', 'fear', 'nostalgia', 'jealousy', 'trust', 'anger', 'joy',
      'valence', 'arousal',
    ]);
    for (const dimension of D09_PROPOSABLE_DIMENSIONS) {
      const proposal = proposedContract([criterion(dimension)]);
      expect(proposal.criteria).toHaveLength(1);
      expect(proposal.criteria[0]?.dimension).toBe(dimension);
      expect(proposal.executionState).toBe('NOT_EXECUTABLE_PHASE_6_15_UNRESOLVED');
    }
  });

  it.each([
    ['participantPseudonymousId', 'other-participant'],
    ['studyId', 'other-study'],
    ['sessionId', 'other-session'],
    ['sequenceId', 'other-sequence'],
    ['eventContext', 'other-context'],
  ] as const)('rejects pooling across %s', (field, value) => {
    const observations = [observation('01'), observation('02', { [field]: value })];
    expect(violationOf(() => createD09UnitTestFixture(fixtureInput(observations))))
      .toBe('UNSUPPORTED_OBSERVATION_POOLING');
  });

  it('does not fabricate planned and eligible denominators', () => {
    const report = evaluateD09(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0);
    expect(report.reportingBoundary.denominatorDefinition)
      .toBe('NOT_EVALUABLE_PHASE_6_15_UNRESOLVED');
    expect('planned' in report).toBe(false);
    expect('eligible' in report).toBe(false);
    expect('contributing' in report).toBe(false);
  });

  it('rejects unsupported exclusion configuration', () => {
    const invalid = {
      ...criterion(),
      exclusions: ['REMOVE_OUTLIERS'],
    } as unknown as D09DimensionCriterion;
    expect(violationOf(() => createD09Contract(contractInput([invalid]))))
      .toBe('INVALID_CRITERION');
  });

  it('rejects unsupported partial-response configuration', () => {
    const invalid = {
      ...criterion(),
      partialResponseRule: 'IMPUTE_PARTIAL_RESPONSE',
    } as unknown as D09DimensionCriterion;
    expect(violationOf(() => createD09Contract(contractInput([invalid]))))
      .toBe('INVALID_CRITERION');
  });

  it('keeps all six missingness states distinct without producing results', () => {
    const statuses = ['OBSERVED', 'MISSING', 'NOT_APPLICABLE', 'INVALID', 'DECLINED', 'WITHDRAWN'] as const;
    const fixture = createD09UnitTestFixture(fixtureInput(statuses.map((status, index) =>
      observation(String(index + 1).padStart(2, '0'), {
        humanMeasurement: status === 'OBSERVED'
          ? { status, value: 0.5 }
          : { status },
      }))));
    expect(fixture.observations.map((item) => item.humanMeasurement.status)).toEqual(statuses);
    expect(evaluateD09(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0, fixture).status)
      .toBe('NOT_EXECUTABLE_TEST_FIXTURE');
  });

  it('rejects empty and non-finite fixtures', () => {
    expect(violationOf(() => createD09UnitTestFixture(fixtureInput([]))))
      .toBe('INVALID_DATASET');
    expect(violationOf(() => createD09UnitTestFixture(fixtureInput([
      observation('01', { humanMeasurement: { status: 'OBSERVED', value: Number.NaN } }),
    ])))).toBe('INVALID_OBSERVATION');
  });

  it('rejects protocol identity mismatch', () => {
    const input = { ...fixtureInput([observation('01')]), protocolHash: 'b'.repeat(64) };
    expect(violationOf(() => createD09UnitTestFixture(input))).toBe('INVALID_DATASET');
  });

  it('rejects a fixture tampered after hash creation', () => {
    const fixture = createD09UnitTestFixture(fixtureInput([observation('01')]));
    const forged = { ...fixture, emoraCommit: 'tampered' };
    expect(violationOf(() => evaluateD09(
      D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0,
      forged,
    ))).toBe('DATASET_HASH_MISMATCH');
  });

  it('snapshots nested contract input before hashing', () => {
    const input = contractInput([criterion()]);
    const artifact = createD09Contract(input);
    const hash = artifact.contractHash;
    (input.criteria[0]!.instrument as unknown as { language: string }).language = 'fr';
    expect(artifact.criteria[0]?.instrument.language).toBe('en');
    expect(artifact.contractHash).toBe(hash);
  });

  it('snapshots nested fixture input before hashing', () => {
    const input = fixtureInput([observation('01')]);
    const fixture = createD09UnitTestFixture(input);
    const hash = fixture.fixtureHash;
    (input.observations[0]!.humanMeasurement as { value?: number }).value = 0.9;
    expect(fixture.observations[0]?.humanMeasurement.value).toBe(0.5);
    expect(fixture.fixtureHash).toBe(hash);
  });

  it('deep-freezes returned nested arrays and objects', () => {
    const contract = D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0;
    const fixture = createD09UnitTestFixture(fixtureInput([observation('01')]));
    expect(Object.isFrozen(contract.scientificBoundaries)).toBe(true);
    expect(Object.isFrozen(fixture.observations)).toBe(true);
    expect(Object.isFrozen(fixture.observations[0]?.humanMeasurement)).toBe(true);
    expect(() => {
      (contract.activeMetrics as unknown as string[]).push('MAE');
    }).toThrow(TypeError);
    expect(() => {
      (fixture.observations[0]!.humanMeasurement as { value?: number }).value = 1;
    }).toThrow(TypeError);
  });

  it('rejects unknown result-shaping fields and exposes no verdict fields', () => {
    const input = contractInput() as unknown as Record<string, unknown>;
    input.validityScore = 0.9;
    expect(violationOf(() => createD09Contract(
      input as unknown as D09DescriptiveEvaluationContractInput,
    ))).toBe('UNKNOWN_FIELD');
    const report = evaluateD09(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0);
    expect(Object.keys(report)).not.toEqual(expect.arrayContaining([
      'validityScore', 'scientificScore', 'winner', 'ranking', 'automaticModelChange',
    ]));
  });
});
