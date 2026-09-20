import { describe, expect, it } from 'vitest';

import { D09_ACTIVE_METRICS } from '../d09/contracts';
import { D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0 } from '../d09/evaluate';
import { EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0 } from '../human-methodology/protocol';
import { calculatePearson } from '../metrics/calculations';
import {
  D10_THRESHOLD_METHODOLOGY_1_0_0,
  D10ValidationError,
  assessD10ThresholdApplicability,
  createD10ThresholdConfiguration,
} from './index';
import type {
  D10PredefinedThresholdConfigurationInput,
  D10ThresholdConfiguration,
  D10ThresholdConfigurationInput,
  D10ThresholdScope,
} from './index';

const SHA = 'a'.repeat(64);

const SCOPE: D10ThresholdScope = {
  metric: 'PEARSON_R',
  dimension: 'joy',
  construct: 'Predefined joy-related observable construct',
  pairedHumanIndicator: 'Governed paired indicator reference',
  instrument: {
    instrumentId: 'instrument-joy',
    instrumentVersion: '1.0.0',
    language: 'en',
  },
  scale: {
    measurementUnit: 'declared-unit',
    scaleType: 'INTERVAL',
    scaleDirection: 'HIGHER_MEANS_MORE',
  },
  population: 'Governed population reference',
  context: 'Governed context reference',
  temporalRelationship: 'CONTEMPORANEOUS',
  transformationReference: 'identity-transformation-v1',
  denominatorMissingnessRuleReference: 'd09-denominator-missingness-boundary',
  exclusionsReference: 'd09-none-configured',
};

function predefinedInput(
  scope: D10ThresholdScope = SCOPE,
): D10PredefinedThresholdConfigurationInput {
  const isolatedScope = structuredClone(scope);
  return {
    status: 'PREDEFINED_SCOPE_BOUND_RULE',
    threshold: {
      thresholdId: 'threshold-methodology-joy-pearson',
      thresholdVersion: '1.0.0',
      rule: {
        kind: 'SCOPED_DESCRIPTIVE_INTERPRETATION_REFERENCE',
        ruleId: 'governed-descriptive-rule',
        ruleVersion: '1.0.0',
        declaredRuleContentHash: SHA,
      },
      scope: isolatedScope,
      provenance: {
        justificationSourceReference: 'owner-approved-methodology-reference',
        derivationData: { role: 'DECLARED_NO_DERIVATION_DATA' },
        methodologyVersion: 'd10-methodology-v1',
        configurationVersion: 'configuration-v1',
        emoraParameterVersion: 'parameter-version-v1',
        emoraEquationVersion: 'equation-version-v1',
      },
      governance: {
        declaredResultIndependent: true,
        declaredThresholdFrozenBeforeResults: true,
        declaredDerivationProcedureFrozenBeforeResults: true,
      },
      freeze: {
        freezeVersion: 'freeze-v1',
        declaredFrozenAt: '2026-09-19T00:00:00.000Z',
      },
    },
  };
}

function predefinedConfiguration(
  scope: D10ThresholdScope = SCOPE,
): D10ThresholdConfiguration {
  return createD10ThresholdConfiguration(predefinedInput(scope));
}

function violationOf(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return error instanceof D10ValidationError ? error.violation : undefined;
  }
}

function application(
  scope: D10ThresholdScope = SCOPE,
  metricStatus:
    'COMPUTED' | 'INVALID' | 'INSUFFICIENT_DATA' | 'UNDEFINED' = 'COMPUTED',
) {
  return {
    metricResult: {
      metricId: scope.metric,
      dimension: scope.dimension,
      value: metricStatus === 'COMPUTED' ? 0 : Number.NaN,
      sampleSize: 2,
      missingCasesCount: 0,
      status: metricStatus,
    },
    scope,
  };
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (typeof value !== 'object' || value === null) return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
}

describe('D10 controlled threshold methodology implementation', () => {
  it('accepts and publishes an immutable no-threshold methodology', () => {
    const methodology = D10_THRESHOLD_METHODOLOGY_1_0_0;
    expect(methodology).toMatchObject({
      status: 'NO_THRESHOLD_DEFINED',
      methodologyStatus: 'D10_METHODOLOGY_RESOLVED',
      humanData: 'NONE',
      numericalThresholds: 'NONE_DEFINED',
    });
    expect(methodology.configurationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(methodology)).toBe(true);
    expect(Object.isFrozen(methodology.governedMetrics)).toBe(true);
    expect(
      assessD10ThresholdApplicability(methodology, application()),
    ).toMatchObject({
      status: 'NO_THRESHOLD_DEFINED',
      interpretation: 'NONE',
      automaticDecision: false,
    });
  });

  it('requires complete scope for a predefined rule', () => {
    const input = predefinedInput() as unknown as Record<string, unknown>;
    const threshold = input.threshold as Record<string, unknown>;
    const scope = threshold.scope as Record<string, unknown>;
    delete scope.context;
    expect(
      violationOf(() =>
        createD10ThresholdConfiguration(
          input as unknown as D10ThresholdConfigurationInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');
  });

  it('preserves threshold provenance and EMORA parameter/equation versions', () => {
    const configuration = predefinedConfiguration();
    expect(configuration.status).toBe('PREDEFINED_SCOPE_BOUND_RULE');
    if (configuration.status !== 'PREDEFINED_SCOPE_BOUND_RULE') return;
    expect(configuration.threshold.provenance).toEqual({
      justificationSourceReference: 'owner-approved-methodology-reference',
      derivationData: { role: 'DECLARED_NO_DERIVATION_DATA' },
      methodologyVersion: 'd10-methodology-v1',
      configurationVersion: 'configuration-v1',
      emoraParameterVersion: 'parameter-version-v1',
      emoraEquationVersion: 'equation-version-v1',
    });
    expect(configuration.threshold.scopeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(configuration.threshold.thresholdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(configuration.threshold).toMatchObject({
      authority: 'UNAUTHORIZED_FUTURE_THRESHOLD_PROPOSAL',
      governance: {
        automaticTransfer: false,
        automaticDecision: false,
        externalChronologyVerification:
          'NOT_VERIFIED_NO_EXTERNAL_TIMELINE_AUTHORITY',
      },
    });
  });

  it('keeps methodology metadata and prohibitions implementation-owned', () => {
    for (const [field, value] of [
      ['methodologyStatus', 'D10_METHODOLOGY_RESOLVED'],
      ['humanData', 'NONE'],
      ['numericalThresholds', 'NONE_DEFINED'],
      ['governedMetrics', [...D09_ACTIVE_METRICS]],
    ] as const) {
      const input = predefinedInput() as unknown as Record<string, unknown>;
      input[field] = value;
      expect(
        violationOf(() =>
          createD10ThresholdConfiguration(
            input as unknown as D10ThresholdConfigurationInput,
          ),
        ),
      ).toBe('UNKNOWN_FIELD');
    }

    const injectedGovernance = predefinedInput() as unknown as Record<
      string,
      unknown
    >;
    const threshold = injectedGovernance.threshold as Record<string, unknown>;
    const governance = threshold.governance as Record<string, unknown>;
    governance.automaticTransfer = false;
    governance.automaticDecision = false;
    expect(
      violationOf(() =>
        createD10ThresholdConfiguration(
          injectedGovernance as unknown as D10ThresholdConfigurationInput,
        ),
      ),
    ).toBe('UNKNOWN_FIELD');
  });

  it('enforces one explicit dimension and rejects global dimension labels', () => {
    const input = predefinedInput({ ...SCOPE, dimension: 'all' as 'joy' });
    expect(violationOf(() => createD10ThresholdConfiguration(input))).toBe(
      'INVALID_SHAPE',
    );
  });

  it('represents no universal Pearson cutoff or numerical threshold field', () => {
    const keys = collectKeys(predefinedConfiguration());
    expect([...keys]).not.toEqual(
      expect.arrayContaining([
        'thresholdValue',
        'cutoff',
        'defaultPearsonThreshold',
        'weak',
        'moderate',
        'strong',
      ]),
    );
    const input = predefinedInput() as unknown as Record<string, unknown>;
    (input.threshold as Record<string, unknown>).thresholdValue = 0.5;
    expect(
      violationOf(() =>
        createD10ThresholdConfiguration(
          input as unknown as D10ThresholdConfigurationInput,
        ),
      ),
    ).toBe('NUMERICAL_THRESHOLD_PROHIBITED');
  });

  it('rejects cutoff and scientific-verdict content hidden in opaque fields', () => {
    for (const mutate of [
      (threshold: Record<string, unknown>) => {
        threshold.thresholdId = 'pearson-cutoff-0.8';
      },
      (threshold: Record<string, unknown>) => {
        (threshold.rule as Record<string, unknown>).ruleId =
          'pass-if-r-gte-0.8';
      },
      (threshold: Record<string, unknown>) => {
        const scope = threshold.scope as Record<string, unknown>;
        scope.context = 'scientific success when correlation is strong';
      },
      (threshold: Record<string, unknown>) => {
        threshold.thresholdId = 'r-0.8';
      },
      (threshold: Record<string, unknown>) => {
        (threshold.rule as Record<string, unknown>).ruleId = 'r-equals-0.8';
      },
      (threshold: Record<string, unknown>) => {
        const scope = threshold.scope as Record<string, unknown>;
        scope.context = 'acceptable correlation 0.8';
      },
      (threshold: Record<string, unknown>) => {
        const scope = threshold.scope as Record<string, unknown>;
        scope.context = 'r ≥ 0.8';
      },
      (threshold: Record<string, unknown>) => {
        const provenance = threshold.provenance as Record<string, unknown>;
        provenance.justificationSourceReference = 'pass-if-r-gte-0.8';
      },
      (threshold: Record<string, unknown>) => {
        const provenance = threshold.provenance as Record<string, unknown>;
        provenance.emoraParameterVersion = 'pass-if-r-gte-0.8';
      },
      (threshold: Record<string, unknown>) => {
        const freeze = threshold.freeze as Record<string, unknown>;
        freeze.freezeVersion = 'pass-if-r-gte-0.8';
      },
      (threshold: Record<string, unknown>) => {
        threshold.thresholdId = 'criterion-0.8';
      },
      (threshold: Record<string, unknown>) => {
        (threshold.rule as Record<string, unknown>).ruleId = 'criterion-0.8';
      },
      (threshold: Record<string, unknown>) => {
        threshold.thresholdId = 'criterion-80-percent';
      },
      (threshold: Record<string, unknown>) => {
        (threshold.rule as Record<string, unknown>).ruleId = 'criterion-80';
      },
    ]) {
      const input = predefinedInput() as unknown as Record<string, unknown>;
      mutate(input.threshold as Record<string, unknown>);
      expect(
        violationOf(() =>
          createD10ThresholdConfiguration(
            input as unknown as D10ThresholdConfigurationInput,
          ),
        ),
      ).toBe('FORBIDDEN_RULE_CONTENT');
    }
  });

  it('rejects a result-derived threshold as a governance violation', () => {
    const input = predefinedInput() as unknown as Record<string, unknown>;
    const threshold = input.threshold as Record<string, unknown>;
    (
      threshold.governance as Record<string, unknown>
    ).declaredResultIndependent = false;
    expect(
      violationOf(() =>
        createD10ThresholdConfiguration(
          input as unknown as D10ThresholdConfigurationInput,
        ),
      ),
    ).toBe('RESULT_DERIVED_PROHIBITED');

    const explicitlyMarked = predefinedInput() as unknown as Record<
      string,
      unknown
    >;
    const markedThreshold = explicitlyMarked.threshold as Record<
      string,
      unknown
    >;
    (markedThreshold.governance as Record<string, unknown>).resultDerived =
      true;
    expect(
      violationOf(() =>
        createD10ThresholdConfiguration(
          explicitlyMarked as unknown as D10ThresholdConfigurationInput,
        ),
      ),
    ).toBe('RESULT_DERIVED_PROHIBITED');

    for (const field of [
      'declaredThresholdFrozenBeforeResults',
      'declaredDerivationProcedureFrozenBeforeResults',
    ]) {
      const notFrozen = predefinedInput() as unknown as Record<string, unknown>;
      const notFrozenThreshold = notFrozen.threshold as Record<string, unknown>;
      (notFrozenThreshold.governance as Record<string, unknown>)[field] = false;
      expect(
        violationOf(() =>
          createD10ThresholdConfiguration(
            notFrozen as unknown as D10ThresholdConfigurationInput,
          ),
        ),
      ).toBe('INVALID_FREEZE');
    }
  });

  it('never treats caller declarations or self-generated hashes as authority', () => {
    const configuration = predefinedConfiguration();
    expect(configuration.status).toBe('PREDEFINED_SCOPE_BOUND_RULE');
    const result = assessD10ThresholdApplicability(
      configuration,
      application(),
    );
    expect(result).toMatchObject({
      status: 'NOT_APPLICABLE_UNAUTHORIZED_THRESHOLD',
      interpretation: 'NONE',
      automaticDecision: false,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(() => {
      (result as { interpretation: string }).interpretation = 'PASS';
    }).toThrow(TypeError);
  });

  it('deep-freezes artifacts and rejects post-hoc replacement with stale hashes', () => {
    const configuration = predefinedConfiguration();
    expect(configuration.status).toBe('PREDEFINED_SCOPE_BOUND_RULE');
    if (configuration.status !== 'PREDEFINED_SCOPE_BOUND_RULE') return;
    expect(Object.isFrozen(configuration.threshold.scope.instrument)).toBe(
      true,
    );
    expect(() => {
      (configuration.threshold.scope as { context: string }).context =
        'post-hoc-context';
    }).toThrow(TypeError);

    const forged = structuredClone(configuration) as unknown as Record<
      string,
      unknown
    >;
    const threshold = forged.threshold as Record<string, unknown>;
    (threshold.scope as Record<string, unknown>).context = 'post-hoc-context';
    expect(
      violationOf(() =>
        assessD10ThresholdApplicability(
          forged as unknown as D10ThresholdConfiguration,
          application(),
        ),
      ),
    ).toBe('CONFIGURATION_HASH_MISMATCH');
  });

  it('snapshots inputs, freezes provenance, and canonicalizes key ordering', () => {
    const input = predefinedInput();
    const configuration = createD10ThresholdConfiguration(input);
    expect(configuration.status).toBe('PREDEFINED_SCOPE_BOUND_RULE');
    if (configuration.status !== 'PREDEFINED_SCOPE_BOUND_RULE') return;
    const originalHash = configuration.configurationHash;
    (
      input.threshold.provenance as { methodologyVersion: string }
    ).methodologyVersion = 'mutated-v2';
    expect(configuration.threshold.provenance.methodologyVersion).toBe(
      'd10-methodology-v1',
    );
    expect(configuration.configurationHash).toBe(originalHash);
    expect(Object.isFrozen(configuration.threshold.provenance)).toBe(true);

    const reordered = predefinedInput() as unknown as {
      threshold: { scope: D10ThresholdScope };
    } & D10PredefinedThresholdConfigurationInput;
    reordered.threshold.scope = {
      context: reordered.threshold.scope.context,
      population: reordered.threshold.scope.population,
      metric: reordered.threshold.scope.metric,
      dimension: reordered.threshold.scope.dimension,
      construct: reordered.threshold.scope.construct,
      pairedHumanIndicator: reordered.threshold.scope.pairedHumanIndicator,
      instrument: reordered.threshold.scope.instrument,
      scale: reordered.threshold.scope.scale,
      temporalRelationship: reordered.threshold.scope.temporalRelationship,
      transformationReference:
        reordered.threshold.scope.transformationReference,
      denominatorMissingnessRuleReference:
        reordered.threshold.scope.denominatorMissingnessRuleReference,
      exclusionsReference: reordered.threshold.scope.exclusionsReference,
    };
    const reorderedConfiguration = createD10ThresholdConfiguration(reordered);
    expect(reorderedConfiguration.configurationHash).toBe(originalHash);
  });

  it('rejects rule, scope-hash, threshold-hash, and configuration-hash mutation', () => {
    const configuration = predefinedConfiguration();
    expect(configuration.status).toBe('PREDEFINED_SCOPE_BOUND_RULE');
    if (configuration.status !== 'PREDEFINED_SCOPE_BOUND_RULE') return;
    for (const mutate of [
      (artifact: Record<string, unknown>) => {
        const threshold = artifact.threshold as Record<string, unknown>;
        const rule = threshold.rule as Record<string, unknown>;
        rule.ruleId = 'replacement-rule';
      },
      (artifact: Record<string, unknown>) => {
        (artifact.threshold as Record<string, unknown>).scopeHash = 'b'.repeat(
          64,
        );
      },
      (artifact: Record<string, unknown>) => {
        (artifact.threshold as Record<string, unknown>).thresholdHash =
          'b'.repeat(64);
      },
      (artifact: Record<string, unknown>) => {
        artifact.configurationHash = 'b'.repeat(64);
      },
    ]) {
      const forged = structuredClone(configuration) as unknown as Record<
        string,
        unknown
      >;
      mutate(forged);
      expect(
        violationOf(() =>
          assessD10ThresholdApplicability(
            forged as unknown as D10ThresholdConfiguration,
            application(),
          ),
        ),
      ).toMatch(/_HASH_MISMATCH$/);
    }
  });

  it('rejects non-plain and prototype-manipulated inputs', () => {
    const input = predefinedInput() as unknown as Record<string, unknown>;
    const threshold = input.threshold as Record<string, unknown>;
    threshold.scope = Object.assign(Object.create({ inherited: true }), SCOPE);
    expect(
      violationOf(() =>
        createD10ThresholdConfiguration(
          input as unknown as D10ThresholdConfigurationInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');
  });

  it('rejects cross-context application without a separately frozen definition', () => {
    const result = assessD10ThresholdApplicability(
      predefinedConfiguration(),
      application({ ...SCOPE, context: 'different-context' }),
    );
    expect(result.status).toBe('NOT_APPLICABLE_SCOPE_MISMATCH');
    expect(result.interpretation).toBe('NONE');
  });

  it('rejects cross-dimension application', () => {
    const result = assessD10ThresholdApplicability(
      predefinedConfiguration(),
      application({ ...SCOPE, dimension: 'fear' }),
    );
    expect(result.status).toBe('NOT_APPLICABLE_SCOPE_MISMATCH');
  });

  it.each(['UNDEFINED', 'INVALID', 'INSUFFICIENT_DATA'] as const)(
    'does not apply a threshold to %s metric output',
    (metricStatus) => {
      const input = application(SCOPE, metricStatus);
      if (metricStatus === 'INSUFFICIENT_DATA') {
        input.metricResult.sampleSize = 1;
      }
      const result = assessD10ThresholdApplicability(
        predefinedConfiguration(),
        input,
      );
      expect(result).toMatchObject({
        status: 'NOT_EVALUABLE_METRIC_STATUS',
        metricStatus,
        interpretation: 'NONE',
        automaticDecision: false,
      });
    },
  );

  it('preserves an actual zero-variance Pearson result as UNDEFINED', () => {
    const undefinedPearson = calculatePearson([1, 1], [0, 1], 'joy');
    expect(undefinedPearson.status).toBe('UNDEFINED');
    const result = assessD10ThresholdApplicability(predefinedConfiguration(), {
      metricResult: undefinedPearson,
      scope: SCOPE,
    });
    expect(result).toMatchObject({
      status: 'NOT_EVALUABLE_METRIC_STATUS',
      metricStatus: 'UNDEFINED',
      interpretation: 'NONE',
    });
  });

  it('leaves D09 denominator and missingness semantics untouched', () => {
    expect(D09_DESCRIPTIVE_EVALUATION_CONTRACT_1_0_0).toMatchObject({
      denominatorDefinition: 'NOT_EVALUABLE_PHASE_6_15_UNRESOLVED',
      thresholds: 'NOT_IMPLEMENTED',
      missingnessStates: [
        'OBSERVED',
        'MISSING',
        'NOT_APPLICABLE',
        'INVALID',
        'DECLINED',
        'WITHDRAWN',
      ],
    });
  });

  it('rejects composite, global, weighted, and ranking fields', () => {
    for (const field of [
      'globalThreshold',
      'compositeThreshold',
      'weightedThreshold',
      'ranking',
    ]) {
      const input = predefinedInput() as unknown as Record<string, unknown>;
      (input.threshold as Record<string, unknown>)[field] = 'prohibited';
      expect(
        violationOf(() =>
          createD10ThresholdConfiguration(
            input as unknown as D10ThresholdConfigurationInput,
          ),
        ),
      ).toBe('GLOBAL_OR_COMPOSITE_THRESHOLD_PROHIBITED');
    }
  });

  it('produces no pass/fail, success, superiority, score, or validity decision', () => {
    const configuration = predefinedConfiguration();
    const result = assessD10ThresholdApplicability(
      configuration,
      application(),
    );
    expect(result.status).toBe('NOT_APPLICABLE_UNAUTHORIZED_THRESHOLD');
    expect(result.interpretation).toBe('NONE');
    expect(result.configurationHash).toBe(configuration.configurationHash);
    if (configuration.status === 'PREDEFINED_SCOPE_BOUND_RULE') {
      expect(result.thresholdHash).toBe(configuration.threshold.thresholdHash);
    }
    expect(Object.keys(result)).not.toEqual(
      expect.arrayContaining([
        'pass',
        'fail',
        'success',
        'superior',
        'score',
        'validity',
        'winner',
      ]),
    );
  });

  it('exposes no significance functionality', () => {
    const input = predefinedInput() as unknown as Record<string, unknown>;
    (input.threshold as Record<string, unknown>).pValue = 0.05;
    expect(
      violationOf(() =>
        createD10ThresholdConfiguration(
          input as unknown as D10ThresholdConfigurationInput,
        ),
      ),
    ).toBe('NUMERICAL_THRESHOLD_PROHIBITED');
    expect(collectKeys(D10_THRESHOLD_METHODOLOGY_1_0_0)).not.toEqual(
      expect.arrayContaining([
        'alpha',
        'pValue',
        'confidenceInterval',
        'hypothesisTest',
      ]),
    );
  });

  it('activates no metric beyond the exact D09 active set', () => {
    expect(D10_THRESHOLD_METHODOLOGY_1_0_0.governedMetrics).toEqual([
      'PEARSON_R',
      'DESCRIPTIVE_DISTRIBUTIONS',
      'COVERAGE_MISSINGNESS',
    ]);
    expect(D10_THRESHOLD_METHODOLOGY_1_0_0.governedMetrics).toEqual(
      D09_ACTIVE_METRICS,
    );

    const input = predefinedInput() as unknown as Record<string, unknown>;
    const threshold = input.threshold as Record<string, unknown>;
    const scope = threshold.scope as Record<string, unknown>;
    scope.metric = 'MAE';
    expect(
      violationOf(() =>
        createD10ThresholdConfiguration(
          input as unknown as D10ThresholdConfigurationInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');
  });

  it('contains no engineering or application flag', () => {
    const keys = collectKeys(D10_THRESHOLD_METHODOLOGY_1_0_0);
    expect(keys.has('engineeringFlag')).toBe(false);
    expect(JSON.stringify(D10_THRESHOLD_METHODOLOGY_1_0_0)).not.toContain(
      'ENGINEERING_FLAG',
    );
    expect(JSON.stringify(D10_THRESHOLD_METHODOLOGY_1_0_0)).not.toContain(
      'APPLICATION_FLAG',
    );
  });

  it('introduces no human data and preserves Phase 6.15 state', () => {
    expect(D10_THRESHOLD_METHODOLOGY_1_0_0.humanData).toBe('NONE');
    expect(EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0).toMatchObject({
      status: 'UNRESOLVED',
      execution: 'NOT_IMPLEMENTED',
      humanData: 'NONE',
    });
  });

  it('introduces no numerical threshold, sample-size, or minimum-N field', () => {
    const keys = collectKeys(predefinedConfiguration());
    expect(keys).not.toEqual(
      expect.arrayContaining([
        'value',
        'thresholdValue',
        'sampleSize',
        'minimumN',
        'minN',
      ]),
    );
  });

  it('keeps existence, applicability, provenance, and violations separate', () => {
    const configuration = predefinedConfiguration();
    const applicationResult = assessD10ThresholdApplicability(
      configuration,
      application(),
    );
    expect(configuration.status).toBe('PREDEFINED_SCOPE_BOUND_RULE');
    expect(applicationResult.status).toBe(
      'NOT_APPLICABLE_UNAUTHORIZED_THRESHOLD',
    );
    if (configuration.status !== 'PREDEFINED_SCOPE_BOUND_RULE') return;
    expect(configuration.threshold.provenance.derivationData.role).toBe(
      'DECLARED_NO_DERIVATION_DATA',
    );
    expect(
      violationOf(() =>
        createD10ThresholdConfiguration({
          ...predefinedInput(),
          threshold: {
            ...predefinedInput().threshold,
            governance: {
              ...predefinedInput().threshold.governance,
              declaredResultIndependent: false,
            } as unknown as D10PredefinedThresholdConfigurationInput['threshold']['governance'],
          },
        }),
      ),
    ).toBe('RESULT_DERIVED_PROHIBITED');
  });

  it('requires exact scope identity for applicability', () => {
    const configuration = predefinedConfiguration();
    expect(
      assessD10ThresholdApplicability(configuration, application()).status,
    ).toBe('NOT_APPLICABLE_UNAUTHORIZED_THRESHOLD');
    expect(
      assessD10ThresholdApplicability(
        configuration,
        application({
          ...SCOPE,
          instrument: { ...SCOPE.instrument, instrumentVersion: '2.0.0' },
        }),
      ).status,
    ).toBe('NOT_APPLICABLE_SCOPE_MISMATCH');
  });

  it('binds applicability to the supplied metric result identity', () => {
    const configuration = predefinedConfiguration();
    const first = assessD10ThresholdApplicability(configuration, application());
    const changedValue = application();
    changedValue.metricResult.value = 0.5;
    const second = assessD10ThresholdApplicability(configuration, changedValue);
    expect(second.metricResultHash).not.toBe(first.metricResultHash);
    expect(second.resultHash).not.toBe(first.resultHash);

    const mismatchedMetric = application();
    mismatchedMetric.metricResult.dimension = 'fear';
    expect(
      assessD10ThresholdApplicability(configuration, mismatchedMetric).status,
    ).toBe('NOT_APPLICABLE_SCOPE_MISMATCH');
  });

  it('binds applicability to the attempted scope rather than only configured scope', () => {
    const configuration = predefinedConfiguration();
    const first = assessD10ThresholdApplicability(
      configuration,
      application({ ...SCOPE, context: 'first-mismatched-context' }),
    );
    const second = assessD10ThresholdApplicability(
      configuration,
      application({ ...SCOPE, context: 'second-mismatched-context' }),
    );
    expect(first.status).toBe('NOT_APPLICABLE_SCOPE_MISMATCH');
    expect(second.status).toBe('NOT_APPLICABLE_SCOPE_MISMATCH');
    expect(first.scopeHash).toBe(second.scopeHash);
    expect(first.attemptedScopeHash).not.toBe(second.attemptedScopeHash);
    expect(first.resultHash).not.toBe(second.resultHash);
  });

  it('rejects malformed or internally invalid metric results', () => {
    const configuration = predefinedConfiguration();
    const missingValue = application() as unknown as {
      metricResult: Record<string, unknown>;
      scope: D10ThresholdScope;
    };
    delete missingValue.metricResult.value;
    expect(
      violationOf(() =>
        assessD10ThresholdApplicability(configuration, missingValue as never),
      ),
    ).toBe('INVALID_SHAPE');

    const nonFiniteComputed = application();
    nonFiniteComputed.metricResult.value = Number.NaN;
    expect(
      violationOf(() =>
        assessD10ThresholdApplicability(configuration, nonFiniteComputed),
      ),
    ).toBe('INVALID_SHAPE');

    for (const value of [
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0,
    ]) {
      const malformedUndefined = application(SCOPE, 'UNDEFINED');
      malformedUndefined.metricResult.value = value;
      expect(
        violationOf(() =>
          assessD10ThresholdApplicability(configuration, malformedUndefined),
        ),
      ).toBe('INVALID_SHAPE');
    }

    const negativeCount = application();
    negativeCount.metricResult.sampleSize = -1;
    expect(
      violationOf(() =>
        assessD10ThresholdApplicability(configuration, negativeCount),
      ),
    ).toBe('INVALID_SHAPE');

    const outOfRangePearson = application();
    outOfRangePearson.metricResult.value = 2;
    expect(
      violationOf(() =>
        assessD10ThresholdApplicability(configuration, outOfRangePearson),
      ),
    ).toBe('INVALID_SHAPE');

    const impossibleComputedPearson = application();
    impossibleComputedPearson.metricResult.sampleSize = 1;
    expect(
      violationOf(() =>
        assessD10ThresholdApplicability(
          configuration,
          impossibleComputedPearson,
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const impossibleUndefinedPearson = application(SCOPE, 'UNDEFINED');
    impossibleUndefinedPearson.metricResult.sampleSize = 1;
    expect(
      violationOf(() =>
        assessD10ThresholdApplicability(
          configuration,
          impossibleUndefinedPearson,
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const impossibleInsufficientPearson = application(
      SCOPE,
      'INSUFFICIENT_DATA',
    );
    expect(
      violationOf(() =>
        assessD10ThresholdApplicability(
          configuration,
          impossibleInsufficientPearson,
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const legacyMissingCount = application();
    legacyMissingCount.metricResult.missingCasesCount = 1;
    expect(
      violationOf(() =>
        assessD10ThresholdApplicability(configuration, legacyMissingCount),
      ),
    ).toBe('INVALID_SHAPE');
  });

  it('rejects a non-canonical or calendar-invalid freeze timestamp', () => {
    for (const declaredFrozenAt of [
      '2026-09-19T00:00:00Z',
      '2026-02-31T00:00:00.000Z',
    ]) {
      const input = predefinedInput();
      const invalid = {
        ...input,
        threshold: {
          ...input.threshold,
          freeze: { ...input.threshold.freeze, declaredFrozenAt },
        },
      };
      expect(violationOf(() => createD10ThresholdConfiguration(invalid))).toBe(
        'INVALID_FREEZE',
      );
    }
  });
});
