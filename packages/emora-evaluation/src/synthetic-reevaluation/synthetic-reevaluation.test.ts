import { describe, expect, it } from 'vitest';

import {
  COMPATIBILITY_AXES,
  MATHEMATICAL_DECISION_REGISTER_1_0_0,
} from '../candidate-comparison/contracts';
import type {
  CandidateFormulationRecord,
  CompatibilityProfile,
} from '../candidate-comparison/contracts';
import { createCandidateComparisonArtifact } from '../candidate-comparison/validation';
import type {
  SyntheticPropertyCase,
  SyntheticReevaluationPlan,
} from './contracts';
import {
  createDeferredHybridFusionArtifact,
  evaluateSyntheticReevaluation,
} from './evaluate';

const governedEventImpact = {
  registerVersion: '1.0.0' as const,
  ...MATHEMATICAL_DECISION_REGISTER_1_0_0.EVENT_IMPACT,
};

const specification = {
  formulationId: 'emora-event-impact-default',
  formulationVersion: '1.0.0',
  formulationKind: 'CURRENT_EMORA' as const,
  component: 'EVENT_IMPACT' as const,
  construct:
    'Computational magnitude assigned to a structured event before emotion-specific influence.',
  equation: {
    expression: 'I = intensity * relevance * (0.5 + 0.5 * surprise)',
    variables: [
      {
        symbol: 'intensity',
        definition: 'Event intensity input.',
        domain: '[0,1]',
        scaleOrUnits: 'dimensionless normalized',
      },
      {
        symbol: 'relevance',
        definition: 'Event relevance input.',
        domain: '[0,1]',
        scaleOrUnits: 'dimensionless normalized',
      },
      {
        symbol: 'surprise',
        definition: 'Event surprise input.',
        domain: '[0,1]',
        scaleOrUnits: 'dimensionless normalized',
      },
      {
        symbol: 'I',
        definition: 'Event impact output.',
        domain: '[0,1] under the documented defaults',
        scaleOrUnits: 'dimensionless',
      },
    ],
  },
  inputDomain: 'intensity, relevance, surprise each in [0,1]',
  outputScale: '[0,1] under documented default coefficients',
  outputUnits: 'dimensionless',
  parameters: [
    {
      symbol: 'surpriseBase',
      definition: 'Default affine surprise intercept.',
      domain: '{0.5}',
      scaleOrUnits: 'dimensionless',
    },
    {
      symbol: 'surpriseScale',
      definition: 'Default affine surprise slope.',
      domain: '{0.5}',
      scaleOrUnits: 'dimensionless',
    },
  ],
  temporalAssumptions: 'Instantaneous per transition; no duration or history.',
  governedDecisionReference: governedEventImpact,
};

const boundsCase: SyntheticPropertyCase<'EVENT_IMPACT'> = {
  caseId: 'event-impact-bounds',
  propertyFamily: 'BOUNDS_INVARIANTS',
  property: 'Documented normalized inputs produce bounded impact.',
  applicability: 'EXECUTABLE',
  runs: [
    {
      runId: 'upper-bound',
      input: { intensity: 1, relevance: 1, surprise: 1 },
    },
  ],
  assertion: {
    kind: 'OUTPUT_IN_RANGE',
    runId: 'upper-bound',
    outputKey: 'impact',
    minimum: 0,
    maximum: 1,
  },
};

function plan(
  cases: readonly SyntheticPropertyCase<'EVENT_IMPACT'>[] = [boundsCase],
): SyntheticReevaluationPlan<'EVENT_IMPACT'> {
  return {
    planId: 'phase-6.14-event-impact',
    planVersion: '1.0.0',
    component: 'EVENT_IMPACT',
    formulation: specification,
    tolerance: {
      absolute: 1e-12,
      relative: 1e-12,
      rationale:
        'Fixed floating-point comparison tolerance for deterministic scalar operations.',
    },
    provenance: {
      methodologyVersion: 'phase-6.14-v1',
      engineCommit: '08a9ff8d4988c460357608be2a831e3b2381e049',
      executorId: 'test-current-event-impact-default',
      executorVersion: '1.0.0',
      executorHash:
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      toolchainIdentity: 'vitest-typescript-node',
      configurationHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    cases,
  };
}

const executeEventImpact = (input: Readonly<Record<string, number>>) => ({
  impact:
    input.intensity! *
    input.relevance! *
    (0.5 + 0.5 * input.surprise!),
});

describe('Phase 6.14 deterministic synthetic mathematical re-evaluation', () => {
  it('produces reproducible component-local outputs, statuses, and hashes', () => {
    const cases: SyntheticPropertyCase<'EVENT_IMPACT'>[] = [
      boundsCase,
      {
        caseId: 'event-impact-surprise-monotonicity',
        propertyFamily: 'MONOTONICITY',
        property: 'Impact is non-decreasing when only surprise increases.',
        applicability: 'EXECUTABLE',
        runs: [
          {
            runId: 'low',
            input: { intensity: 0.8, relevance: 0.7, surprise: 0.1 },
          },
          {
            runId: 'high',
            input: { intensity: 0.8, relevance: 0.7, surprise: 0.9 },
          },
        ],
        assertion: {
          kind: 'NON_DECREASING',
          firstRunId: 'low',
          secondRunId: 'high',
          outputKey: 'impact',
        },
      },
    ];
    const first = evaluateSyntheticReevaluation(
      plan(cases),
      executeEventImpact,
    );
    const second = evaluateSyntheticReevaluation(
      plan(cases),
      executeEventImpact,
    );

    expect(first).toEqual(second);
    expect(first.artifactHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.scope).toBe('COMPONENT_LOCAL_SYNTHETIC_MATHEMATICAL');
    expect(first.results.map((result) => result.status)).toEqual([
      'SATISFIED',
      'SATISFIED',
    ]);
    expect(first.results[1]?.observations[0]?.output.impact).toBeCloseTo(0.308);
    expect(first.results[1]?.observations[1]?.output.impact).toBeCloseTo(0.532);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.results)).toBe(true);
  });

  it('changes the artifact hash when equation, tolerance, or configuration changes', () => {
    const original = evaluateSyntheticReevaluation(plan(), executeEventImpact);
    const changedEquation = evaluateSyntheticReevaluation(
      {
        ...plan(),
        formulation: {
          ...specification,
          equation: {
            ...specification.equation,
            expression:
              'I = intensity * relevance * (0.5000001 + 0.5 * surprise)',
          },
        },
      },
      executeEventImpact,
    );
    const changedTolerance = evaluateSyntheticReevaluation(
      {
        ...plan(),
        tolerance: { ...plan().tolerance, absolute: 1e-10 },
      },
      executeEventImpact,
    );
    const changedConfiguration = evaluateSyntheticReevaluation(
      {
        ...plan(),
        provenance: {
          ...plan().provenance,
          configurationHash:
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        },
      },
      executeEventImpact,
    );

    expect(changedEquation.artifactHash).not.toBe(original.artifactHash);
    expect(changedTolerance.artifactHash).not.toBe(original.artifactHash);
    expect(changedConfiguration.artifactHash).not.toBe(original.artifactHash);
  });

  it('accepts IEEE-754 representation error at the declared tolerance boundary', () => {
    const approximateCase: SyntheticPropertyCase<'EVENT_IMPACT'> = {
      caseId: 'floating-point-boundary',
      propertyFamily: 'NUMERICAL_STABILITY',
      property: 'Floating-point representation remains within tolerance.',
      applicability: 'EXECUTABLE',
      runs: [{ runId: 'sum', input: {} }],
      assertion: {
        kind: 'OUTPUT_APPROX_EQUALS',
        runId: 'sum',
        outputKey: 'impact',
        expected: 0.3,
      },
    };
    const artifact = evaluateSyntheticReevaluation(
      plan([approximateCase]),
      () => ({ impact: 0.1 + 0.2 }),
    );
    const exactOnly = evaluateSyntheticReevaluation(
      {
        ...plan([approximateCase]),
        tolerance: {
          absolute: 0,
          relative: 0,
          rationale: 'Exact comparison control.',
        },
      },
      () => ({ impact: 0.1 + 0.2 }),
    );

    expect(artifact.results[0]?.status).toBe('SATISFIED');
    expect(exactOnly.results[0]?.status).toBe('VIOLATED');
  });

  it('records a reproducible counterexample for a violated property', () => {
    const artifact = evaluateSyntheticReevaluation(
      plan([
        {
          ...boundsCase,
          caseId: 'impossible-range',
          assertion: {
            kind: 'OUTPUT_IN_RANGE',
            runId: 'upper-bound',
            outputKey: 'impact',
            minimum: 0,
            maximum: 0.5,
          },
        },
      ]),
      executeEventImpact,
    );

    expect(artifact.results[0]?.status).toBe('VIOLATED');
    expect(artifact.results[0]?.counterexample).toEqual({
      caseId: 'impossible-range',
      property: boundsCase.property,
      runs: artifact.results[0]?.observations,
      expected: 'impact is in [0, 0.5]',
      observed: '1',
    });
  });

  it('records non-finite numerical output as a hashable violation', () => {
    const artifact = evaluateSyntheticReevaluation(
      plan([
        {
          caseId: 'non-finite-output',
          propertyFamily: 'NUMERICAL_STABILITY',
          property: 'Impact remains finite.',
          applicability: 'EXECUTABLE',
          runs: [{ runId: 'unstable', input: {} }],
          assertion: {
            kind: 'FINITE_OUTPUTS',
            runId: 'unstable',
            outputKeys: ['impact'],
          },
        },
      ]),
      () => ({ impact: Number.NaN }),
    );

    expect(artifact.results[0]?.status).toBe('VIOLATED');
    expect(artifact.results[0]?.observations[0]?.output.impact).toBe('NaN');
    expect(artifact.results[0]?.counterexample).toBeDefined();
    expect(artifact.artifactHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('detects non-deterministic execution without inferential statistics', () => {
    let value = 0;
    const artifact = evaluateSyntheticReevaluation(plan(), () => ({
      impact: (value += 1),
    }));

    expect(artifact.results[0]?.status).toBe('VIOLATED');
    expect(artifact.results[0]?.observed).toContain('different canonical outputs');
  });

  it('preserves explicit NOT_APPLICABLE without executing the formulation', () => {
    let calls = 0;
    const artifact = evaluateSyntheticReevaluation(
      plan([
        {
          caseId: 'no-temporal-behavior',
          propertyFamily: 'EDGE_LIMITING_CASES',
          property: 'Independent temporal trajectory.',
          applicability: 'NOT_APPLICABLE',
          reason: 'Event Impact is instantaneous.',
          runs: [],
        },
      ]),
      () => {
        calls += 1;
        return { impact: 0 };
      },
    );

    expect(calls).toBe(0);
    expect(artifact.results[0]?.status).toBe('NOT_APPLICABLE');
    expect(artifact.results[0]?.reason).toBe('Event Impact is instantaneous.');
  });

  it('preserves NOT_APPLICABLE even when the formulation is incomplete', () => {
    let calls = 0;
    const artifact = evaluateSyntheticReevaluation(
      {
        ...plan([
          {
            caseId: 'not-applicable-incomplete',
            propertyFamily: 'EDGE_LIMITING_CASES',
            property: 'No independent temporal behavior.',
            applicability: 'NOT_APPLICABLE',
            reason: 'The property does not apply.',
            runs: [],
          },
        ]),
        formulation: {
          formulationId: 'incomplete-current',
          formulationVersion: '1.0.0',
          formulationKind: 'CURRENT_EMORA',
          component: 'EVENT_IMPACT',
        },
      },
      () => {
        calls += 1;
        return { impact: 0 };
      },
    );

    expect(calls).toBe(0);
    expect(artifact.results[0]?.status).toBe('NOT_APPLICABLE');
  });

  it('marks an incompletely specified candidate NOT_EVALUABLE without execution', () => {
    let calls = 0;
    const incomplete = plan();
    const artifact = evaluateSyntheticReevaluation(
      {
        ...incomplete,
        formulation: {
          formulationId: 'undocumented-candidate',
          formulationVersion: '0.0.0',
          formulationKind: 'CANDIDATE',
          component: 'EVENT_IMPACT',
        },
      },
      () => {
        calls += 1;
        return { impact: 0 };
      },
    );

    expect(calls).toBe(0);
    expect(artifact.results[0]?.status).toBe('NOT_EVALUABLE');
    expect(artifact.results[0]?.reason).toContain('equation.expression');
    expect(artifact.results[0]?.reason).toContain('temporalAssumptions');
  });

  it('rejects a forged candidate reference instead of executing it', () => {
    const compatibility = Object.fromEntries(
      COMPATIBILITY_AXES.map((axis) => [axis, { value: 'UNKNOWN' as const }]),
    ) as CompatibilityProfile;
    const recordedCandidate: CandidateFormulationRecord<'EVENT_IMPACT'> = {
      candidateId: 'recorded-candidate',
      component: 'EVENT_IMPACT',
      family: 'MULTIPLICATIVE',
      label: 'Recorded candidate',
      provenance: {
        sourceStatus: 'UNVERIFIED',
        interpretation: 'NOT_REPORTED',
      },
      equation: {
        expression: specification.equation.expression,
        variables: specification.equation.variables.map(
          ({ symbol, definition, scaleOrUnits }) => ({
            symbol,
            definition,
            unitsOrScale: scaleOrUnits,
          }),
        ),
      },
      constructMapping: {
        emoraConstruct: specification.construct,
        candidateConstruct: specification.construct,
        qualifiers: {},
      },
      inputs: ['intensity', 'relevance', 'surprise'],
      outputs: ['impact'],
      scale: specification.outputScale,
      temporalAssumptions: specification.temporalAssumptions,
      parameterAssumptions: 'Documented default coefficients.',
      compatibility,
      evidenceTypes: ['MATHEMATICAL'],
      limitations: [],
      syntheticEvaluation: {
        evidenceClass: 'SYNTHETIC_MATHEMATICAL',
        requirements: [
          { kind: 'BOUNDEDNESS', description: 'Check documented bounds.' },
        ],
      },
      humanEvaluation: {
        evidenceClass: 'HUMAN_BEHAVIORAL',
        requirements: [
          { kind: 'TARGET_CONSTRUCT', description: 'Deferred human construct.' },
        ],
      },
      revisitTriggers: [],
      analyticalObservations: [],
    };
    const comparisonArtifact = createCandidateComparisonArtifact({
      artifactId: 'event-impact-candidates',
      artifactVersion: '1.0.0',
      component: 'EVENT_IMPACT',
      governedDecisionReference: governedEventImpact,
      currentFormulationSummary: 'Current Event Impact formulation.',
      candidates: [recordedCandidate],
    });
    let calls = 0;
    expect(() =>
      evaluateSyntheticReevaluation(
        {
          ...plan(),
          formulation: {
            ...specification,
            formulationId: 'forged-candidate',
            formulationKind: 'CANDIDATE',
            candidateReference: {
              comparisonArtifact,
              candidateId: 'forged-candidate',
              family: 'MULTIPLICATIVE',
            },
          },
        },
        () => {
          calls += 1;
          return { impact: 0 };
        },
      ),
    ).toThrow('must exist in the referenced Phase 6.13 artifact');
    expect(calls).toBe(0);
  });

  it('rejects undeclared property families instead of creating a metric', () => {
    const invalid = plan([
      {
        ...boundsCase,
        propertyFamily: 'OVERALL_QUALITY' as 'BOUNDS_INVARIANTS',
      },
    ]);
    expect(() =>
      evaluateSyntheticReevaluation(invalid, executeEventImpact),
    ).toThrow('not declared for EVENT_IMPACT');
  });
});

describe('Phase 6.14 Hybrid Fusion deferral', () => {
  it('records MDR-009 as DEFERRED and exposes no evaluation input', () => {
    const first = createDeferredHybridFusionArtifact();
    const second = createDeferredHybridFusionArtifact();

    expect(first).toEqual(second);
    expect(first.component).toBe('HYBRID_FUSION');
    expect(first.disposition).toBe('DEFERRED');
    expect(first.reason).toContain('does not implement or evaluate Hybrid Fusion');
    expect(first.artifactHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toHaveProperty('results');
  });

  it('rejects a runtime Hybrid Fusion execution attempt without invoking its executor', () => {
    let calls = 0;
    expect(() =>
      evaluateSyntheticReevaluation(
        {
          ...plan(),
          component: 'HYBRID_FUSION',
          formulation: {
            ...specification,
            component: 'HYBRID_FUSION',
          },
        } as unknown as SyntheticReevaluationPlan<'EVENT_IMPACT'>,
        () => {
          calls += 1;
          return { hybrid: 0 };
        },
      ),
    ).toThrow('HYBRID_FUSION is DEFERRED');
    expect(calls).toBe(0);
  });
});
