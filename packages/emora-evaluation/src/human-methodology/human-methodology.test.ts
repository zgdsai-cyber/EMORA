import { describe, expect, it } from 'vitest';

import { hashCanonical } from '../canonicalize';
import type {
  DescriptiveEvaluationCriterion,
  HumanBehavioralEvaluationProtocolInput,
  HumanConstructMapping,
} from './contracts';
import {
  EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0,
} from './protocol';
import {
  createHumanBehavioralEvaluationProtocol,
  HumanMethodologyValidationError,
} from './validation';

function input(): HumanBehavioralEvaluationProtocolInput {
  const {
    protocolHash: _protocolHash,
    scopeKind: _scopeKind,
    execution: _execution,
    humanData: _humanData,
    ...protocolInput
  } = structuredClone(EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0);
  void _protocolHash;
  void _scopeKind;
  void _execution;
  void _humanData;
  return protocolInput;
}

function violationOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(HumanMethodologyValidationError);
    return (error as HumanMethodologyValidationError).violation;
  }
}

describe('Phase 6.15 governed human methodology protocol', () => {
  it('creates the valid minimal versioned methodology artifact without human data or execution', () => {
    const artifact = EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0;

    expect(artifact.protocolVersion).toBe('1.0.0');
    expect(artifact.methodologyVersion).toBe('phase-6.15-v1');
    expect(artifact.status).toBe('UNRESOLVED');
    expect(artifact.scopeKind).toBe('HUMAN_METHODOLOGY_ONLY');
    expect(artifact.execution).toBe('NOT_IMPLEMENTED');
    expect(artifact.humanData).toBe('NONE');
    expect(artifact.protocolHash).toMatch(/^[0-9a-f]{64}$/);
    expect(artifact.scope.computationalOnlyOutputs).toEqual([
      'confidence',
      'confidenceAdjustment',
    ]);
    expect(artifact.scope.deferredComponents).toEqual(['HYBRID_FUSION']);
  });

  it('rejects promotion to DEFINED while any required mapping remains unresolved', () => {
    const unresolved = input();
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol({
          ...unresolved,
          status: 'DEFINED',
        }),
      ),
    ).toBe('INVALID_STATUS_CONFIGURATION');
  });

  it('requires explicit governed population and partition states', () => {
    for (const field of ['population', 'partitioning'] as const) {
      const incomplete = input() as unknown as Record<string, unknown>;
      delete incomplete[field];
      expect(
        violationOf(() =>
          createHumanBehavioralEvaluationProtocol(
            incomplete as unknown as HumanBehavioralEvaluationProtocolInput,
          ),
        ),
        field,
      ).toBe('INVALID_SHAPE');
    }

    const missingPopulationReason = input();
    (missingPopulationReason.population as { unresolvedReason?: string })
      .unresolvedReason = undefined;
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(missingPopulationReason),
      ),
    ).toBe('INVALID_SHAPE');

    const untrackedPopulation = input();
    (
      untrackedPopulation.unresolvedItems as unknown as {
        domain: string;
      }[]
    ) = untrackedPopulation.unresolvedItems.filter(
      (item) => item.domain !== 'POPULATION',
    );
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(untrackedPopulation),
      ),
    ).toBe('INVALID_STATUS_CONFIGURATION');
  });

  it('does not allow a DEFINED criterion to depend on an unresolved mapping', () => {
    const invalid = input();
    const criterionIndex = invalid.descriptiveCriteria.findIndex(
      (criterion) => criterion.kind === 'DESCRIPTIVE_ASSOCIATION',
    );
    const criterion = invalid.descriptiveCriteria[criterionIndex]!;
    const { unresolvedReason: _unresolvedReason, ...criterionWithoutReason } =
      criterion;
    void _unresolvedReason;
    (invalid.descriptiveCriteria as DescriptiveEvaluationCriterion[])[criterionIndex] = {
      ...criterionWithoutReason,
      status: 'DEFINED',
      mappingIds: ['mapping-love'],
      predefinedDefinition: 'Describe paired values without inference.',
    };

    expect(
      violationOf(() => createHumanBehavioralEvaluationProtocol(invalid)),
    ).toBe('INVALID_CRITERION');

    const coverageInvalid = input();
    const coverageIndex = coverageInvalid.descriptiveCriteria.findIndex(
      (item) => item.kind === 'COVERAGE_MISSINGNESS_REPORTING',
    );
    const coverage = coverageInvalid.descriptiveCriteria[coverageIndex]!;
    (coverageInvalid.descriptiveCriteria as DescriptiveEvaluationCriterion[])[
      coverageIndex
    ] = { ...coverage, mappingIds: ['mapping-love'] };
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(coverageInvalid),
      ),
    ).toBe('INVALID_CRITERION');
  });

  it('preserves an explicit NOT_EVALUABLE protocol as non-executable methodology', () => {
    const artifact = createHumanBehavioralEvaluationProtocol({
      ...input(),
      status: 'NOT_EVALUABLE',
    });

    expect(artifact.status).toBe('NOT_EVALUABLE');
    expect(artifact.execution).toBe('NOT_IMPLEMENTED');
    expect(artifact.humanData).toBe('NONE');
    expect(
      artifact.unresolvedItems.some(
        (item) => item.status === 'NOT_EVALUABLE',
      ),
    ).toBe(true);
  });

  it('rejects unknown fields at root and nested levels', () => {
    const root = { ...input(), extra: true };
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(
          root as HumanBehavioralEvaluationProtocolInput,
        ),
      ),
    ).toBe('UNKNOWN_FIELD');

    const nested = input();
    const first = nested.constructMappings[0]!;
    (nested.constructMappings as HumanConstructMapping[])[0] = {
      ...first,
      inventedEquivalence: true,
    } as typeof first;
    expect(
      violationOf(() => createHumanBehavioralEvaluationProtocol(nested)),
    ).toBe('UNKNOWN_FIELD');
  });

  it('rejects invalid enum values and inconsistent status configuration', () => {
    const invalidStatus = input();
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol({
          ...invalidStatus,
          status: 'READY' as 'DEFINED',
        }),
      ),
    ).toBe('INVALID_ENUM');

    const malformedDefined = input();
    const coverageIndex = malformedDefined.descriptiveCriteria.findIndex(
      (criterion) => criterion.kind === 'COVERAGE_MISSINGNESS_REPORTING',
    );
    const coverage = malformedDefined.descriptiveCriteria[coverageIndex]!;
    (
      malformedDefined.descriptiveCriteria as DescriptiveEvaluationCriterion[]
    )[coverageIndex] = {
      ...coverage,
      unresolvedReason: 'Contradicts DEFINED.',
    };
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(malformedDefined),
      ),
    ).toBe('INVALID_STATUS_CONFIGURATION');
  });

  it('deep-copies and freezes the artifact against caller and output mutation', () => {
    const callerInput = input();
    const artifact = createHumanBehavioralEvaluationProtocol(callerInput);
    const originalHash = artifact.protocolHash;

    (
      callerInput.constructMappings[0] as { description: string }
    ).description = 'Caller mutation.';
    expect(artifact.constructMappings[0]?.description).not.toBe(
      'Caller mutation.',
    );
    expect(artifact.protocolHash).toBe(originalHash);
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.isFrozen(artifact.constructMappings)).toBe(true);
    expect(Object.isFrozen(artifact.constructMappings[0])).toBe(true);
    expect(() => {
      (
        artifact as unknown as { protocolHash: string }
      ).protocolHash = 'tampered';
    }).toThrow(TypeError);
    expect(() => {
      (
        artifact.constructMappings as unknown as { description: string }[]
      )[0]!.description = 'tampered';
    }).toThrow(TypeError);
  });

  it('produces stable canonical hashes for identical content and key reordering', () => {
    const firstInput = input();
    const reordered = Object.fromEntries(
      Object.entries(firstInput).reverse(),
    ) as unknown as HumanBehavioralEvaluationProtocolInput;
    const first = createHumanBehavioralEvaluationProtocol(firstInput);
    const second = createHumanBehavioralEvaluationProtocol(input());
    const third = createHumanBehavioralEvaluationProtocol(reordered);

    expect(second).toEqual(first);
    expect(second.protocolHash).toBe(first.protocolHash);
    expect(third.protocolHash).toBe(first.protocolHash);
  });

  it('publishes the hash of exactly the complete governed representation', () => {
    const artifact = EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0;
    const { protocolHash, ...governed } = artifact;

    expect(protocolHash).toBe(hashCanonical(governed));
    expect(Object.keys(artifact).sort()).toEqual(
      [...Object.keys(input()), 'execution', 'humanData', 'protocolHash', 'scopeKind'].sort(),
    );
  });

  it('changes the hash when any governed mapping, criterion, or ethics input changes', () => {
    const original = createHumanBehavioralEvaluationProtocol(input());

    const mappingChanged = input();
    (
      mappingChanged.constructMappings[0] as { description: string }
    ).description += ' Changed.';
    const mappingArtifact = createHumanBehavioralEvaluationProtocol(mappingChanged);

    const criterionChanged = input();
    (
      criterionChanged.descriptiveCriteria[0] as { description: string }
    ).description += ' Changed.';
    const criterionArtifact =
      createHumanBehavioralEvaluationProtocol(criterionChanged);

    const ethicsChanged = input();
    (
      ethicsChanged.ethicsGovernance as { description: string }
    ).description += ' Changed.';
    const ethicsArtifact = createHumanBehavioralEvaluationProtocol(ethicsChanged);

    expect(mappingArtifact.protocolHash).not.toBe(original.protocolHash);
    expect(criterionArtifact.protocolHash).not.toBe(original.protocolHash);
    expect(ethicsArtifact.protocolHash).not.toBe(original.protocolHash);
  });

  it('rejects inherited toJSON, custom prototypes, and accessors without invoking them', () => {
    const original = input();
    const inheritedToJSON = Object.assign(
      Object.create({
        toJSON: () => ({ ...original, status: 'DEFINED', winner: 'EMORA' }),
      }),
      original,
    ) as HumanBehavioralEvaluationProtocolInput;
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(inheritedToJSON),
      ),
    ).toBe('INVALID_SHAPE');

    let getterCalls = 0;
    const accessor = input();
    Object.defineProperty(accessor, 'protocolId', {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 'getter-controlled';
      },
    });
    expect(
      violationOf(() => createHumanBehavioralEvaluationProtocol(accessor)),
    ).toBe('INVALID_SHAPE');
    expect(getterCalls).toBe(0);
  });

  it('rejects hostile array prototypes, sparse arrays, symbols, and extra numeric properties', () => {
    const customPrototype = input();
    Object.setPrototypeOf(
      customPrototype.constructMappings,
      Object.create(Array.prototype, {
        toJSON: { value: () => [] },
      }),
    );
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(customPrototype),
      ),
    ).toBe('INVALID_SHAPE');

    const sparse = input();
    (sparse.constructMappings as unknown as unknown[]).length += 1;
    expect(
      violationOf(() => createHumanBehavioralEvaluationProtocol(sparse)),
    ).toBe('INVALID_SHAPE');

    const extraIndex = input();
    Object.defineProperty(extraIndex.constructMappings, '4294967295', {
      value: 'forbidden',
      enumerable: true,
    });
    expect(
      violationOf(() => createHumanBehavioralEvaluationProtocol(extraIndex)),
    ).toBe('INVALID_SHAPE');

    const symbol = input();
    Object.defineProperty(symbol.constructMappings, Symbol('winner'), {
      value: 'EMORA',
      enumerable: true,
    });
    expect(
      violationOf(() => createHumanBehavioralEvaluationProtocol(symbol)),
    ).toBe('INVALID_SHAPE');
  });

  it('rejects forbidden field aliases and inferential executable definitions', () => {
    for (const forbidden of [
      'p_value',
      'confidence-interval',
      'hypothesis_testing',
      'compositeValidityScore',
      'causal_inference',
      'clinicalInterpretation',
    ]) {
      const invalid = { ...input(), [forbidden]: true };
      expect(
        violationOf(() =>
          createHumanBehavioralEvaluationProtocol(
            invalid as HumanBehavioralEvaluationProtocolInput,
          ),
        ),
        forbidden,
      ).toBe('FORBIDDEN_SCOPE');
    }

    const inferential = input();
    const coverageIndex = inferential.descriptiveCriteria.findIndex(
      (criterion) => criterion.kind === 'COVERAGE_MISSINGNESS_REPORTING',
    );
    const coverage = inferential.descriptiveCriteria[coverageIndex]!;
    (inferential.descriptiveCriteria as DescriptiveEvaluationCriterion[])[
      coverageIndex
    ] = {
      ...coverage,
      predefinedDefinition: 'Report p-values and confidence intervals.',
    };
    expect(
      violationOf(() => createHumanBehavioralEvaluationProtocol(inferential)),
    ).toBe('FORBIDDEN_SCOPE');

    const unresolvedWithForbiddenMethod = input();
    const firstMapping = unresolvedWithForbiddenMethod.constructMappings[0]!;
    (
      unresolvedWithForbiddenMethod.constructMappings as HumanConstructMapping[]
    )[0] = {
      ...firstMapping,
      measurementDefinition: 'Optimize against p-values.',
    };
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(unresolvedWithForbiddenMethod),
      ),
    ).toBe('FORBIDDEN_SCOPE');

    for (const forbiddenDefinition of [
      'Compute a recommendation score.',
      'Select the preferred formulation.',
      'Compare against a trained model.',
    ]) {
      const invalidDefinition = input();
      const first = invalidDefinition.constructMappings[0]!;
      (
        invalidDefinition.constructMappings as HumanConstructMapping[]
      )[0] = {
        ...first,
        measurementDefinition: forbiddenDefinition,
      };
      expect(
        violationOf(() =>
          createHumanBehavioralEvaluationProtocol(invalidDefinition),
        ),
        forbiddenDefinition,
      ).toBe('FORBIDDEN_SCOPE');
    }
  });

  it('rejects malformed optional governed fields even while unresolved', () => {
    const malformed = input();
    const firstMapping = malformed.constructMappings[0]!;
    (malformed.constructMappings as HumanConstructMapping[])[0] = {
      ...firstMapping,
      humanConstruct: 42,
    } as unknown as HumanConstructMapping;

    expect(
      violationOf(() => createHumanBehavioralEvaluationProtocol(malformed)),
    ).toBe('INVALID_SHAPE');

    const explicitUndefined = input();
    Object.defineProperty(explicitUndefined.population, 'targetPopulation', {
      value: undefined,
      enumerable: true,
    });
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(explicitUndefined),
      ),
    ).toBe('INVALID_SHAPE');
  });

  it('rejects forbidden concepts in falsifiability conditions', () => {
    const invalid = input();
    const first = invalid.falsifiabilityConditions[0]!;
    (
      invalid.falsifiabilityConditions as unknown as {
        condition: string;
      }[]
    )[0] = {
      ...first,
      condition: 'Compute p-values and select the winner.',
    };

    expect(
      violationOf(() => createHumanBehavioralEvaluationProtocol(invalid)),
    ).toBe('FORBIDDEN_SCOPE');
  });

  it('requires NOT_EVALUABLE criteria and baselines to remain explicitly tracked', () => {
    const criterionInput = input();
    const criterion = criterionInput.descriptiveCriteria[0]!;
    (
      criterionInput.descriptiveCriteria as DescriptiveEvaluationCriterion[]
    )[0] = {
      ...criterion,
      status: 'NOT_EVALUABLE',
      unresolvedReason: 'No suitable mapping.',
    };
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(criterionInput),
      ),
    ).toBe('INVALID_STATUS_CONFIGURATION');

    const baselineInput = input();
    (
      baselineInput.baselines.definitions as unknown as Record<string, unknown>[]
    ).push({
      baselineId: 'not-evaluable-baseline',
      baselineVersion: '1.0.0',
      baselineKind: 'OTHER_PREDEFINED',
      status: 'NOT_EVALUABLE',
      description: 'No suitable baseline is defined.',
      unresolvedReason: 'The baseline construct is not evaluable.',
    });
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(baselineInput),
      ),
    ).toBe('INVALID_STATUS_CONFIGURATION');
  });

  it('reports a governed validation error when a required collection is missing', () => {
    const missing = input() as unknown as Record<string, unknown>;
    delete missing.constructMappings;
    expect(
      violationOf(() =>
        createHumanBehavioralEvaluationProtocol(
          missing as unknown as HumanBehavioralEvaluationProtocolInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');
  });

  it('rejects inferential, scientific-validity, ranking, score, and winner fields', () => {
    for (const forbidden of [
      'pValue',
      'confidenceInterval',
      'scientificSupportLabel',
      'scientificValidity',
      'score',
      'rank',
      'winner',
      'recommendation',
      'calibration',
      'optimization',
      'clinicalDiagnosis',
    ]) {
      const invalid = { ...input(), [forbidden]: 'forbidden' };
      expect(
        violationOf(() =>
          createHumanBehavioralEvaluationProtocol(
            invalid as HumanBehavioralEvaluationProtocolInput,
          ),
        ),
        forbidden,
      ).toBe('FORBIDDEN_SCOPE');
    }
  });

  it('exports no evaluation, inference, ranking, scoring, winner, or selection function', async () => {
    const module = await import('./index');
    const functionNames = Object.entries(module)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name);

    expect(functionNames).toEqual([
      'HumanMethodologyValidationError',
      'createHumanBehavioralEvaluationProtocol',
    ]);
    for (const name of Object.keys(module))
      expect(name).not.toMatch(
        /execute|evaluate|infer|pValue|confidenceInterval|rank|score|winner|recommend|select|calibrat|optimi[sz]/i,
      );
  });
});
