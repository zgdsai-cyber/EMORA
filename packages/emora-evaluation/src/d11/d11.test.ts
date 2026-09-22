import { describe, expect, it } from 'vitest';

import * as D11 from './index';
import { D09_ACTIVE_METRICS } from '../d09/contracts';
import { D10_THRESHOLD_METHODOLOGY_1_0_0 } from '../d10';
import { hashCanonical } from '../canonicalize';
import { EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0 } from '../human-methodology';
import {
  D11_AUTHORITY_REFERENCE_REQUIREMENT,
  D11_BASELINE_KINDS,
  D11_CONTRACT_VERSION,
  D11_METHODOLOGY_VERSION,
  D11ValidationError,
  compareD11EvaluationRuns,
  computeD11MetricEvidenceHash,
  createD11BaselineAuthority,
  createD11BaselineDefinition,
  createD11BaselineRunIdentity,
  createD11CandidateRunIdentity,
  verifyD11ComparisonArtifact,
} from './index';
import type {
  D11BaselineAuthorityArtifact,
  D11BaselineDefinitionArtifact,
  D11BaselineDefinitionInput,
  D11BaselineRunIdentityArtifact,
  D11BaselineScope,
  D11CandidateRunIdentityArtifact,
  D11ComparisonArtifact,
  D11ComparisonInput,
  D11IdentityReference,
  D11MetricEvidence,
} from './index';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SHA_D = 'd'.repeat(64);

const MODEL_IDENTITY: D11IdentityReference = {
  id: 'emora-engine',
  version: '1.0.0',
  hash: SHA_A,
};
const PARAMETER_IDENTITY: D11IdentityReference = {
  id: 'parameter-set',
  version: '1.0.0',
  hash: SHA_B,
};

function scope(overrides: Partial<D11BaselineScope> = {}): D11BaselineScope {
  return {
    datasetIdentity: {
      applicability: 'APPLICABLE',
      value: {
        datasetId: 'd11-test-dataset',
        datasetVersion: '1.0.0',
        datasetHash: SHA_A,
      },
    },
    orderedCaseIds: {
      applicability: 'APPLICABLE',
      value: ['case-one', 'case-two'],
    },
    evaluationContractIdentity: {
      applicability: 'APPLICABLE',
      value: { contractVersion: '1.0.0', contractHash: SHA_B },
    },
    metric: 'PEARSON_R',
    targetOutput: 'joy-output',
    dimension: 'joy',
    construct: {
      applicability: 'APPLICABLE',
      value: 'declared-joy-related-construct',
    },
    scale: {
      type: 'INTERVAL',
      units: 'declared-unit',
      direction: 'HIGHER_MEANS_MORE',
    },
    observationUnit: 'case-dimension-pair',
    context: 'governed-software-evaluation-context',
    modelIdentity: {
      applicability: 'NOT_APPLICABLE',
      reason:
        'Constant references do not require candidate model identity equality.',
    },
    parameterConfigurationIdentity: {
      applicability: 'NOT_APPLICABLE',
      reason:
        'No candidate parameter identity equality is required for this constant.',
    },
    ...overrides,
  };
}

function definitionInput(
  overrides: Partial<D11BaselineDefinitionInput> = {},
): D11BaselineDefinitionInput {
  return {
    baselineId: 'governed-constant-reference',
    baselineVersion: '1.0.0',
    kind: 'CONSTANT',
    configuration: {
      kind: 'CONSTANT',
      // Test-only scoped values; these are not defaults or scientific references.
      targetValues: { joy: 0.23 },
    },
    scope: scope(),
    provenance: {
      sourceReference: 'd11-test-source-reference',
      justificationReference: 'd11-test-justification-reference',
      // Test-only declaration that no data source contributed to this reference.
      derivationDataAbsence: 'DECLARED_NO_DERIVATION_DATA',
      basisReference: 'd11-test-declared-absence-basis',
      dataSources: [],
    },
    justification: 'Deterministic test-only contextual reference.',
    predefinition: {
      status: 'ESTABLISHED',
      evidenceReference: 'd11-test-predefinition-evidence',
      freezeId: 'd11-test-freeze',
      freezeVersion: '1.0.0',
      declaredFrozenAt: '2026-09-19T00:00:00.000Z',
      externalChronologyVerification: 'DOCUMENTED_EXTERNAL_EVIDENCE',
    },
    independence: {
      status: 'ESTABLISHED',
      fittedOnEvaluationResults: false,
      tunedOnEvaluationResults: false,
      optimizedOnEvaluationResults: false,
      selectedUsingEvaluationResults: false,
      postResultDecision: false,
      reusedEvaluationResults: false,
      evaluationDataOverlap: false,
      evidenceReference: 'd11-test-independence-evidence',
    },
    ...overrides,
  };
}

function ablationInput(): D11BaselineDefinitionInput {
  const governedScope = scope({
    modelIdentity: { applicability: 'APPLICABLE', value: MODEL_IDENTITY },
    parameterConfigurationIdentity: {
      applicability: 'APPLICABLE',
      value: PARAMETER_IDENTITY,
    },
  });
  return definitionInput({
    baselineId: 'governed-interaction-ablation',
    kind: 'DETERMINISTIC_ABLATION',
    configuration: {
      kind: 'DETERMINISTIC_ABLATION',
      operation: 'ZERO_INTERACTION_WEIGHTS',
      lineage: {
        modelIdentity: MODEL_IDENTITY,
        parameterConfigurationIdentity: PARAMETER_IDENTITY,
      },
      preservedConfigurationHash: SHA_C,
      mechanismReference: 'interaction-weight-mechanism',
    },
    scope: governedScope,
  });
}

function authority(
  definition: D11BaselineDefinitionArtifact,
): D11BaselineAuthorityArtifact {
  return createD11BaselineAuthority(definition, {
    authorityId: 'd11-test-governance-decision',
    authorityVersion: '1.0.0',
    decision: 'APPROVED_D11_BASELINE_DEFINITION',
    approvedDefinitionHash: definition.baselineDefinitionHash,
    approvalEvidenceReference: 'd11-test-approved-decision-record',
    approvedAt: '2026-09-19T01:00:00.000Z',
    authorityRequirement: D11_AUTHORITY_REFERENCE_REQUIREMENT,
  });
}

function metric(
  status: D11MetricEvidence['status'] = 'COMPUTED',
  dimension: D11MetricEvidence['dimension'] = 'joy',
): D11MetricEvidence {
  const content = {
    metric: 'PEARSON_R' as const,
    dimension,
    status,
    ...(status === 'COMPUTED' ? { value: 0.31 } : {}),
  };
  return { ...content, resultHash: computeD11MetricEvidenceHash(content) };
}

function candidateRun(
  governedScope = scope(),
  metricEvidence: readonly D11MetricEvidence[] = [metric()],
): D11CandidateRunIdentityArtifact {
  return createD11CandidateRunIdentity({
    role: 'CANDIDATE',
    runId: 'candidate-run',
    effectiveConfigurationHash: SHA_D,
    providerIdentity: MODEL_IDENTITY,
    parameterIdentity: {
      applicability: 'APPLICABLE',
      value: PARAMETER_IDENTITY,
    },
    toolchainIdentity: {
      applicability: 'APPLICABLE',
      value: { id: 'node-toolchain', version: '24.0.0', hash: SHA_C },
    },
    datasetIdentity: {
      datasetId: 'd11-test-dataset',
      datasetVersion: '1.0.0',
      datasetHash: SHA_A,
    },
    evaluationContractIdentity: {
      contractVersion: '1.0.0',
      contractHash: SHA_B,
    },
    orderedCaseIds: ['case-one', 'case-two'],
    scope: governedScope,
    metricEvidence,
    executionTimestamp: '2026-09-19T02:00:00.000Z',
  });
}

function baselineRun(
  definition: D11BaselineDefinitionArtifact,
  governedScope = definition.scope,
  metricEvidence: readonly D11MetricEvidence[] = [metric()],
): D11BaselineRunIdentityArtifact {
  return createD11BaselineRunIdentity({
    role: 'BASELINE',
    runId: 'baseline-run',
    baselineDefinitionHash: definition.baselineDefinitionHash,
    effectiveConfigurationHash:
      definition.configuration.kind === 'CONSTANT'
        ? definition.configurationHash
        : definition.configuration.preservedConfigurationHash,
    providerIdentity: {
      id: 'd11-baseline-provider',
      version: '1.0.0',
      hash: SHA_C,
    },
    parameterIdentity: governedScope.parameterConfigurationIdentity,
    toolchainIdentity: {
      applicability: 'APPLICABLE',
      value: { id: 'node-toolchain', version: '24.0.0', hash: SHA_C },
    },
    datasetIdentity: {
      datasetId: 'd11-test-dataset',
      datasetVersion: '1.0.0',
      datasetHash: SHA_A,
    },
    evaluationContractIdentity: {
      contractVersion: '1.0.0',
      contractHash: SHA_B,
    },
    orderedCaseIds: ['case-one', 'case-two'],
    scope: governedScope,
    metricEvidence,
    executionTimestamp: '2026-09-19T02:01:00.000Z',
  });
}

// Returns the run input without the artifact-owned identity hash so a test can
// re-issue the run identity under changed conditions.
function runInputWithoutHash(
  run: D11BaselineRunIdentityArtifact,
): Omit<D11BaselineRunIdentityArtifact, 'runIdentityHash'> {
  const { runIdentityHash, ...input } = run;
  if (runIdentityHash.length !== 64)
    throw new D11ValidationError(
      'INVALID_RUN_IDENTITY',
      'Run identity hash must be a SHA-256 hex digest.',
    );
  return input;
}

function comparable(
  definition = createD11BaselineDefinition(definitionInput()),
): D11ComparisonArtifact {
  return compareD11EvaluationRuns({
    comparatorId: 'd11-descriptive-comparator',
    comparatorVersion: '1.0.0',
    candidateRun: candidateRun(definition.scope),
    baselineDefinition: definition,
    baselineAuthority: authority(definition),
    baselineRun: baselineRun(definition),
  });
}

function violationOf(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return error instanceof D11ValidationError ? error.violation : undefined;
  }
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (typeof value !== 'object' || value === null) return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
}

describe('D11 Baseline & Comparator Methodology v1.0.0', () => {
  it('creates a canonical immutable governed CONSTANT definition without automatic authority', () => {
    const input = definitionInput();
    const definition = createD11BaselineDefinition(input);
    expect(definition).toMatchObject({
      contractVersion: D11_CONTRACT_VERSION,
      methodologyVersion: D11_METHODOLOGY_VERSION,
      kind: 'CONSTANT',
      semantics: 'PREDEFINED_CONTEXTUAL_REFERENCE_ONLY',
      automaticAuthority: false,
    });
    expect(definition.configurationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(definition.scopeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(definition.baselineDefinitionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(definition.configuration)).toBe(true);
    expect(Object.isFrozen(definition.scope.scale)).toBe(true);

    (
      input.configuration as unknown as { targetValues: { joy: number } }
    ).targetValues.joy = 0.91;
    expect(definition.configuration).toMatchObject({
      targetValues: { joy: 0.23 },
    });
  });

  it('creates the two authorized deterministic ablation definitions and no engine', () => {
    for (const operation of [
      'ZERO_INTERACTION_WEIGHTS',
      'ZERO_PERSONALITY_SENSITIVITY_WEIGHTS',
    ] as const) {
      const input = ablationInput();
      const definition = createD11BaselineDefinition({
        ...input,
        configuration: { ...input.configuration, operation },
      } as D11BaselineDefinitionInput);
      expect(definition.configuration).toMatchObject({
        kind: 'DETERMINISTIC_ABLATION',
        operation,
      });
    }
    expect(Object.keys(D11)).not.toContain('executeD11DeterministicAblation');
  });

  it('keeps the taxonomy closed and rejects unsupported kinds and ablations', () => {
    expect(D11_BASELINE_KINDS).toEqual(['CONSTANT', 'DETERMINISTIC_ABLATION']);
    const unsupportedKind = {
      ...definitionInput(),
      kind: 'PERSISTENCE',
      configuration: { kind: 'PERSISTENCE' },
    };
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          unsupportedKind as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('UNSUPPORTED_BASELINE_KIND');

    const unsupportedAblation = ablationInput();
    (
      unsupportedAblation.configuration as unknown as Record<string, unknown>
    ).operation = 'RANDOMIZE_WEIGHTS';
    expect(
      violationOf(() => createD11BaselineDefinition(unsupportedAblation)),
    ).toBe('UNSUPPORTED_ABLATION');
  });

  it('produces reproducible hashes independent of property ordering', () => {
    const first = createD11BaselineDefinition(definitionInput());
    const source = definitionInput();
    const reordered = {
      independence: source.independence,
      predefinition: source.predefinition,
      justification: source.justification,
      provenance: source.provenance,
      scope: source.scope,
      configuration: source.configuration,
      kind: source.kind,
      baselineVersion: source.baselineVersion,
      baselineId: source.baselineId,
    };
    const second = createD11BaselineDefinition(reordered);
    expect(second.baselineDefinitionHash).toBe(first.baselineDefinitionHash);
  });

  it('requires a separate authority artifact bound to the exact definition hash', () => {
    const definition = createD11BaselineDefinition(definitionInput());
    const governedAuthority = authority(definition);
    expect(governedAuthority).toMatchObject({
      authorityKind: 'VERSIONED_DECLARED_GOVERNANCE_ARTIFACT',
      approvedDefinitionHash: definition.baselineDefinitionHash,
      callerDeclarationAloneIsAuthority: false,
    });
    expect(governedAuthority.authorityHash).toMatch(/^[0-9a-f]{64}$/);

    expect(
      violationOf(() =>
        createD11BaselineAuthority(definition, {
          authorityId: 'd11-test-governance-decision',
          authorityVersion: '1.0.0',
          decision: 'APPROVED_D11_BASELINE_DEFINITION',
          approvedDefinitionHash: SHA_D,
          approvalEvidenceReference: 'd11-test-approved-decision-record',
          approvedAt: '2026-09-19T01:00:00.000Z',
          authorityRequirement: D11_AUTHORITY_REFERENCE_REQUIREMENT,
        }),
      ),
    ).toBe('INVALID_AUTHORITY');
  });

  it('rejects a caller-authored authority requirement look-alike and a self-hashed forgery', () => {
    const definition = createD11BaselineDefinition(definitionInput());
    const lookAlike = {
      requirementId: 'd11-authority-requirement',
      requirementVersion: '1.0.0',
      requirementKind: 'REQUIRES_SEPARATELY_ISSUED_GOVERNANCE_DECISION',
      bindingRule: 'EXACT_BASELINE_DEFINITION_HASH',
      verifiedByD11: false,
      adjudicatesExternalAuthority: false,
      notes:
        'Caller-authored look-alike that must not substitute for the governed requirement.',
    };
    expect(
      violationOf(() =>
        createD11BaselineAuthority(definition, {
          authorityId: 'd11-test-governance-decision',
          authorityVersion: '1.0.0',
          decision: 'APPROVED_D11_BASELINE_DEFINITION',
          approvedDefinitionHash: definition.baselineDefinitionHash,
          approvalEvidenceReference: 'd11-test-approved-decision-record',
          approvedAt: '2026-09-19T01:00:00.000Z',
          authorityRequirement: lookAlike as never,
        }),
      ),
    ).toBe('INVALID_AUTHORITY');

    // A forged authority whose own hash is recomputed to stay self-consistent is
    // still rejected, because the requirement is enforced by object identity and
    // the artifact is re-derived from the exact governed definition.
    const forged = {
      ...structuredClone(authority(definition)),
      authorityRequirement: lookAlike,
    } as unknown as Record<string, unknown>;
    const forgedContent = { ...forged };
    delete forgedContent.authorityHash;
    forged.authorityHash = hashCanonical(forgedContent);
    expect(
      violationOf(() =>
        compareD11EvaluationRuns({
          comparatorId: 'd11-descriptive-comparator',
          comparatorVersion: '1.0.0',
          candidateRun: candidateRun(definition.scope),
          baselineDefinition: definition,
          baselineAuthority: forged as never,
          baselineRun: baselineRun(definition),
        }),
      ),
    ).toBe('INVALID_AUTHORITY');

    // The requirement constant is not an authority artifact and cannot be used
    // as one, even though it is exported for comparison.
    expect(D11_AUTHORITY_REFERENCE_REQUIREMENT).toMatchObject({
      verifiedByD11: false,
      adjudicatesExternalAuthority: false,
    });
    expect(
      violationOf(() =>
        compareD11EvaluationRuns({
          comparatorId: 'd11-descriptive-comparator',
          comparatorVersion: '1.0.0',
          candidateRun: candidateRun(definition.scope),
          baselineDefinition: definition,
          baselineAuthority: D11_AUTHORITY_REFERENCE_REQUIREMENT as never,
          baselineRun: baselineRun(definition),
        }),
      ),
    ).toBe('UNKNOWN_FIELD');
  });

  it('does not grant authority through caller fields or an absent authority artifact', () => {
    const injected = definitionInput() as unknown as Record<string, unknown>;
    injected.approved = true;
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          injected as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('UNKNOWN_FIELD');

    const definition = createD11BaselineDefinition(definitionInput());
    const result = compareD11EvaluationRuns({
      comparatorId: 'd11-descriptive-comparator',
      comparatorVersion: '1.0.0',
      candidateRun: candidateRun(definition.scope),
      baselineDefinition: definition,
      baselineRun: baselineRun(definition),
    });
    expect(result).toMatchObject({
      status: 'NOT_EVALUABLE',
      reasons: ['UNAUTHORIZED_BASELINE'],
    });
  });

  it('requires provenance and documented predefinition evidence', () => {
    const missingProvenance = definitionInput() as unknown as Record<
      string,
      unknown
    >;
    delete (missingProvenance.provenance as Record<string, unknown>)
      .sourceReference;
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          missingProvenance as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const invalidChronology = definitionInput({
      predefinition: {
        ...definitionInput().predefinition,
        externalChronologyVerification:
          'NOT_VERIFIED_NO_EXTERNAL_TIMELINE_AUTHORITY',
      },
    });
    expect(
      violationOf(() => createD11BaselineDefinition(invalidChronology)),
    ).toBe('INVALID_PREDEFINITION_EVIDENCE');

    const insufficient = createD11BaselineDefinition(
      definitionInput({
        predefinition: {
          ...definitionInput().predefinition,
          status: 'INSUFFICIENT',
          externalChronologyVerification:
            'NOT_VERIFIED_NO_EXTERNAL_TIMELINE_AUTHORITY',
        },
      }),
    );
    expect(comparableWith(insufficient).status).toBe('NOT_EVALUABLE');
    expect(comparableWith(insufficient).reasons).toContain(
      'PREDEFINITION_NOT_ESTABLISHED',
    );
  });

  it('fails closed for missing independence evidence, leakage, and result-derived declarations', () => {
    const insufficient = createD11BaselineDefinition(
      definitionInput({
        independence: {
          ...definitionInput().independence,
          status: 'INSUFFICIENT',
          evaluationDataOverlap: 'UNKNOWN',
        },
      }),
    );
    expect(comparableWith(insufficient)).toMatchObject({
      status: 'NOT_EVALUABLE',
      reasons: ['INDEPENDENCE_NOT_ESTABLISHED'],
    });

    const leaking = createD11BaselineDefinition(
      definitionInput({
        provenance: {
          sourceReference: 'd11-test-source-reference',
          justificationReference: 'd11-test-justification-reference',
          derivationDataAbsence: 'DECLARED_DERIVATION_DATA',
          dataSources: [
            {
              role: 'DEVELOPMENT_TUNING',
              identity: {
                id: 'evaluation-data',
                version: '1.0.0',
                hash: SHA_D,
              },
              derivationUse: 'USED_TO_SET_VALUES',
              overlapsEvaluationData: true,
              independenceEvidenceReference: 'd11-test-leak-independence',
              removesReference: 'declared-none',
            },
          ],
        },
      }),
    );
    expect(comparableWith(leaking)).toMatchObject({
      status: 'NOT_EVALUABLE',
      reasons: ['EVALUATION_DATA_LEAKAGE'],
    });

    for (const field of [
      'fittedOnEvaluationResults',
      'tunedOnEvaluationResults',
      'optimizedOnEvaluationResults',
      'selectedUsingEvaluationResults',
      'postResultDecision',
      'reusedEvaluationResults',
    ]) {
      const input = definitionInput() as unknown as Record<string, unknown>;
      (input.independence as Record<string, unknown>)[field] = true;
      expect(
        violationOf(() =>
          createD11BaselineDefinition(
            input as unknown as D11BaselineDefinitionInput,
          ),
        ),
      ).toBe('INVALID_INDEPENDENCE_EVIDENCE');
    }
  });

  it('does not treat an empty data-source list as evidence of independence', () => {
    const base = definitionInput();

    // A declared derivation must carry at least one declared data source; an
    // empty list is not accepted as proof that nothing was derived.
    const undeclaredDerivation = {
      ...base,
      provenance: {
        sourceReference: base.provenance.sourceReference,
        justificationReference: base.provenance.justificationReference,
        derivationDataAbsence: 'DECLARED_DERIVATION_DATA' as const,
        dataSources: [],
      },
    };
    expect(
      violationOf(() => createD11BaselineDefinition(undeclaredDerivation)),
    ).toBe('INVALID_PROVENANCE');

    // A declared absence must actually be empty and must state its basis.
    const contradictoryAbsence = {
      ...base,
      provenance: {
        sourceReference: base.provenance.sourceReference,
        justificationReference: base.provenance.justificationReference,
        derivationDataAbsence: 'DECLARED_NO_DERIVATION_DATA' as const,
        basisReference: 'd11-test-declared-absence-basis',
        dataSources: [
          {
            role: 'HELD_OUT' as const,
            identity: { id: 'held-out-data', version: '1.0.0', hash: SHA_D },
            derivationUse: 'REFERENCE_ONLY' as const,
            overlapsEvaluationData: false as const,
            independenceEvidenceReference: 'd11-test-held-out-independence',
            removesReference: 'declared-none',
          },
        ],
      },
    };
    expect(
      violationOf(() => createD11BaselineDefinition(contradictoryAbsence)),
    ).toBe('INVALID_PROVENANCE');

    // The provenance derivation declaration itself must be stated explicitly.
    const missingDeclaration = base as unknown as Record<string, unknown>;
    delete (missingDeclaration.provenance as Record<string, unknown>)
      .derivationDataAbsence;
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          missingDeclaration as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');

    // A source whose independence is unstated fails closed rather than being
    // treated as independent.
    const unknownSource = createD11BaselineDefinition({
      ...base,
      provenance: {
        sourceReference: base.provenance.sourceReference,
        justificationReference: base.provenance.justificationReference,
        derivationDataAbsence: 'DECLARED_DERIVATION_DATA',
        dataSources: [
          {
            role: 'EXTERNAL_REFERENCE',
            identity: { id: 'external-corpus', version: '1.0.0', hash: SHA_D },
            derivationUse: 'REFERENCE_ONLY',
            overlapsEvaluationData: 'UNKNOWN',
            independenceEvidenceReference: 'd11-test-external-independence',
            removesReference: 'declared-none',
          },
        ],
      },
    });
    expect(comparableWith(unknownSource)).toMatchObject({
      status: 'NOT_EVALUABLE',
      reasons: ['INDEPENDENCE_NOT_ESTABLISHED'],
    });
  });

  it('creates distinct candidate, baseline-run, definition, and comparison identities', () => {
    const definition = createD11BaselineDefinition(definitionInput());
    const result = comparableWith(definition);
    expect(result.status).toBe('COMPARABLE');
    expect(result.reasons).toEqual(['GOVERNED_PAIRING_SATISFIED']);
    expect(result.candidateRun.runIdentityHash).not.toBe(
      result.baselineRun.runIdentityHash,
    );
    expect(result.baselineDefinition.baselineDefinitionHash).toBe(
      result.baselineRun.baselineDefinitionHash,
    );
    expect(result.comparisonHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyD11ComparisonArtifact(result)).toEqual(result);
  });

  it.each([
    [
      'dataset id',
      (run: D11BaselineRunIdentityArtifact) => ({
        ...run,
        datasetIdentity: { ...run.datasetIdentity, datasetId: 'other-dataset' },
      }),
      'DATASET_IDENTITY_MISMATCH',
    ],
    [
      'dataset version',
      (run: D11BaselineRunIdentityArtifact) => ({
        ...run,
        datasetIdentity: { ...run.datasetIdentity, datasetVersion: '2.0.0' },
      }),
      'DATASET_IDENTITY_MISMATCH',
    ],
    [
      'dataset hash',
      (run: D11BaselineRunIdentityArtifact) => ({
        ...run,
        datasetIdentity: { ...run.datasetIdentity, datasetHash: SHA_D },
      }),
      'DATASET_IDENTITY_MISMATCH',
    ],
    [
      'case order',
      (run: D11BaselineRunIdentityArtifact) => ({
        ...run,
        orderedCaseIds: [...run.orderedCaseIds].reverse(),
      }),
      'CASE_ORDER_MISMATCH',
    ],
    [
      'contract',
      (run: D11BaselineRunIdentityArtifact) => ({
        ...run,
        evaluationContractIdentity: {
          ...run.evaluationContractIdentity,
          contractHash: SHA_D,
        },
      }),
      'EVALUATION_CONTRACT_MISMATCH',
    ],
  ] as const)(
    'returns NOT_COMPARABLE for %s mismatch',
    (_label, mutate, reason) => {
      const definition = createD11BaselineDefinition(definitionInput());
      const original = baselineRun(definition);
      const mutated = mutate(original);
      const input = runInputWithoutHash(mutated);
      const result = compareD11EvaluationRuns({
        comparatorId: 'd11-descriptive-comparator',
        comparatorVersion: '1.0.0',
        candidateRun: candidateRun(definition.scope),
        baselineDefinition: definition,
        baselineAuthority: authority(definition),
        baselineRun: createD11BaselineRunIdentity(input),
      });
      expect(result.status).toBe('NOT_COMPARABLE');
      expect(result.reasons).toContain(reason);
    },
  );

  it.each([
    ['dimension', { dimension: 'fear' }, 'DIMENSION_MISMATCH'],
    [
      'units',
      { scale: { ...scope().scale, units: 'different-unit' } },
      'SCALE_MISMATCH',
    ],
    [
      'direction',
      { scale: { ...scope().scale, direction: 'HIGHER_MEANS_LESS' } },
      'SCALE_MISMATCH',
    ],
    ['context', { context: 'different-context' }, 'CONTEXT_MISMATCH'],
  ] as const)(
    'returns NOT_COMPARABLE for %s scope mismatch',
    (_label, override, reason) => {
      const definition = createD11BaselineDefinition(definitionInput());
      const result = compareD11EvaluationRuns({
        comparatorId: 'd11-descriptive-comparator',
        comparatorVersion: '1.0.0',
        candidateRun: candidateRun(definition.scope),
        baselineDefinition: definition,
        baselineAuthority: authority(definition),
        baselineRun: baselineRun(
          definition,
          scope(override as Partial<D11BaselineScope>),
        ),
      });
      expect(result.status).toBe('NOT_COMPARABLE');
      expect(result.reasons).toContain(reason);
    },
  );

  it('does not impose candidate model equality on a constant baseline', () => {
    const definition = createD11BaselineDefinition(definitionInput());
    const result = comparableWith(definition);
    expect(result.status).toBe('COMPARABLE');
    expect(result.candidateRun.providerIdentity).not.toEqual(
      result.baselineRun.providerIdentity,
    );
  });

  it('binds ablations to lineage and preserved configuration without executing them', () => {
    const definition = createD11BaselineDefinition(ablationInput());
    expect(comparableWith(definition).status).toBe('COMPARABLE');

    const wrongScope = scope({
      modelIdentity: {
        applicability: 'APPLICABLE',
        value: { ...MODEL_IDENTITY, hash: SHA_D },
      },
      parameterConfigurationIdentity: {
        applicability: 'APPLICABLE',
        value: PARAMETER_IDENTITY,
      },
    });
    const result = compareD11EvaluationRuns({
      comparatorId: 'd11-descriptive-comparator',
      comparatorVersion: '1.0.0',
      candidateRun: candidateRun(definition.scope),
      baselineDefinition: definition,
      baselineAuthority: authority(definition),
      baselineRun: baselineRun(definition, wrongScope),
    });
    expect(result).toMatchObject({
      status: 'NOT_EVALUABLE',
      reasons: ['ABLATION_LINEAGE_MISMATCH'],
    });
  });

  it('fails closed when execution configuration or definition scope is not bound', () => {
    const definition = createD11BaselineDefinition(definitionInput());
    const originalRun = baselineRun(definition);
    const runInput = runInputWithoutHash(originalRun);
    const wrongConfiguration = createD11BaselineRunIdentity({
      ...runInput,
      effectiveConfigurationHash: SHA_D,
    });
    expect(
      compareD11EvaluationRuns({
        comparatorId: 'd11-descriptive-comparator',
        comparatorVersion: '1.0.0',
        candidateRun: candidateRun(definition.scope),
        baselineDefinition: definition,
        baselineAuthority: authority(definition),
        baselineRun: wrongConfiguration,
      }),
    ).toMatchObject({
      status: 'NOT_EVALUABLE',
      reasons: ['BASELINE_CONFIGURATION_MISMATCH'],
    });

    const changedScope = scope({ context: 'shared-but-unauthorized-context' });
    expect(
      compareD11EvaluationRuns({
        comparatorId: 'd11-descriptive-comparator',
        comparatorVersion: '1.0.0',
        candidateRun: candidateRun(changedScope),
        baselineDefinition: definition,
        baselineAuthority: authority(definition),
        baselineRun: baselineRun(definition, changedScope),
      }),
    ).toMatchObject({
      status: 'NOT_EVALUABLE',
      reasons: ['BASELINE_SCOPE_BINDING_MISMATCH'],
    });
  });

  it.each(['UNDEFINED', 'INVALID', 'INSUFFICIENT_DATA'] as const)(
    'preserves %s metrics as NOT_EVALUABLE rather than zero',
    (status) => {
      const definition = createD11BaselineDefinition(definitionInput());
      const result = compareD11EvaluationRuns({
        comparatorId: 'd11-descriptive-comparator',
        comparatorVersion: '1.0.0',
        candidateRun: candidateRun(definition.scope, [metric(status)]),
        baselineDefinition: definition,
        baselineAuthority: authority(definition),
        baselineRun: baselineRun(definition),
      });
      expect(result).toMatchObject({
        status: 'NOT_EVALUABLE',
        reasons: ['METRIC_RESULT_NOT_EVALUABLE'],
      });
      expect(result.candidateRun.metricEvidence[0]).not.toHaveProperty('value');
    },
  );

  it('handles multiple baselines only as independent pairwise artifacts', () => {
    const firstDefinition = createD11BaselineDefinition(definitionInput());
    const secondDefinition = createD11BaselineDefinition(
      definitionInput({
        baselineId: 'second-governed-constant-reference',
        configuration: { kind: 'CONSTANT', targetValues: { joy: 0.67 } },
      }),
    );
    const results = [
      comparableWith(firstDefinition),
      comparableWith(secondDefinition),
    ];
    expect(results.every((result) => result.status === 'COMPARABLE')).toBe(
      true,
    );
    expect(results[0].comparisonHash).not.toBe(results[1].comparisonHash);
    expect(collectKeys(results)).not.toEqual(
      expect.arrayContaining([
        'primaryBaseline',
        'bestBaseline',
        'aggregateScore',
      ]),
    );
  });

  it('does not let baseline supply order affect comparison semantics', () => {
    const firstDefinition = createD11BaselineDefinition(definitionInput());
    const secondDefinition = createD11BaselineDefinition(
      definitionInput({
        baselineId: 'second-governed-constant-reference',
        configuration: { kind: 'CONSTANT', targetValues: { joy: 0.67 } },
      }),
    );
    const forward = [
      comparableWith(firstDefinition),
      comparableWith(secondDefinition),
    ];
    const reversed = [
      comparableWith(secondDefinition),
      comparableWith(firstDefinition),
    ];
    expect(reversed.map((result) => result.comparisonHash).reverse()).toEqual(
      forward.map((result) => result.comparisonHash),
    );
    expect(reversed.map((result) => result.status)).toEqual(
      forward.map((result) => result.status),
    );
  });

  it('rejects threshold, ranking, winner, superiority, score, and recommendation fields', () => {
    for (const field of [
      'threshold',
      'ranking',
      'winner',
      'superiorityScore',
      'score',
      'recommendation',
      'passFail',
    ]) {
      const definition = definitionInput() as unknown as Record<
        string,
        unknown
      >;
      definition[field] = 0.5;
      expect(
        violationOf(() =>
          createD11BaselineDefinition(
            definition as unknown as D11BaselineDefinitionInput,
          ),
        ),
      ).toBe('PROHIBITED_SEMANTICS');
    }

    const definition = createD11BaselineDefinition(definitionInput());
    const comparison = {
      comparatorId: 'd11-descriptive-comparator',
      comparatorVersion: '1.0.0',
      candidateRun: candidateRun(definition.scope),
      baselineDefinition: definition,
      baselineAuthority: authority(definition),
      baselineRun: baselineRun(definition),
      threshold: 0.5,
    };
    expect(
      violationOf(() =>
        compareD11EvaluationRuns(comparison as unknown as D11ComparisonInput),
      ),
    ).toBe('PROHIBITED_SEMANTICS');
  });

  it('rejects stale hashes, post-snapshot mutation, accessors, symbols, cycles, and non-finite values', () => {
    const definition = createD11BaselineDefinition(definitionInput());
    const stale = structuredClone(definition);
    (stale.scope as { context: string }).context = 'mutated-context';
    expect(
      violationOf(() =>
        compareD11EvaluationRuns({
          comparatorId: 'd11-descriptive-comparator',
          comparatorVersion: '1.0.0',
          candidateRun: candidateRun(definition.scope),
          baselineDefinition: stale,
          baselineAuthority: authority(definition),
          baselineRun: baselineRun(definition),
        }),
      ),
    ).toBe('BASELINE_DEFINITION_HASH_MISMATCH');

    const staleAuthority = structuredClone(authority(definition));
    (
      staleAuthority as { approvalEvidenceReference: string }
    ).approvalEvidenceReference = 'replacement-evidence';
    expect(
      violationOf(() =>
        compareD11EvaluationRuns({
          comparatorId: 'd11-descriptive-comparator',
          comparatorVersion: '1.0.0',
          candidateRun: candidateRun(definition.scope),
          baselineDefinition: definition,
          baselineAuthority: staleAuthority,
          baselineRun: baselineRun(definition),
        }),
      ),
    ).toBe('AUTHORITY_HASH_MISMATCH');

    const staleRun = structuredClone(baselineRun(definition));
    (staleRun.datasetIdentity as { datasetHash: string }).datasetHash = SHA_D;
    expect(
      violationOf(() =>
        compareD11EvaluationRuns({
          comparatorId: 'd11-descriptive-comparator',
          comparatorVersion: '1.0.0',
          candidateRun: candidateRun(definition.scope),
          baselineDefinition: definition,
          baselineAuthority: authority(definition),
          baselineRun: staleRun,
        }),
      ),
    ).toBe('RUN_IDENTITY_HASH_MISMATCH');

    const staleComparison = structuredClone(comparableWith(definition));
    (staleComparison as { status: string }).status = 'NOT_COMPARABLE';
    expect(
      violationOf(() => verifyD11ComparisonArtifact(staleComparison)),
    ).toBe('COMPARISON_HASH_MISMATCH');

    expect(() => {
      (definition.scope as { context: string }).context = 'post-snapshot';
    }).toThrow(TypeError);

    const accessor = definitionInput() as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, 'baselineId', {
      enumerable: true,
      get: () => 'accessor-baseline',
    });
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          accessor as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const symbolInput = definitionInput() as unknown as Record<
      PropertyKey,
      unknown
    >;
    symbolInput[Symbol('hidden')] = 'hidden';
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          symbolInput as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const polluted = Object.assign(
      Object.create({ inheritedAuthority: true }),
      definitionInput(),
    );
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          polluted as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const circular = definitionInput() as unknown as Record<string, unknown>;
    circular.circular = circular;
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          circular as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('INVALID_SHAPE');

    for (const value of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0,
    ]) {
      const invalid = definitionInput({
        configuration: { kind: 'CONSTANT', targetValues: { joy: value } },
      });
      expect(violationOf(() => createD11BaselineDefinition(invalid))).toBe(
        'INVALID_CONSTANT_CONFIGURATION',
      );
    }

    const invalidMetricContent = {
      metric: 'PEARSON_R' as const,
      dimension: 'joy' as const,
      status: 'COMPUTED' as const,
      value: Number.POSITIVE_INFINITY,
    };
    const invalidMetric = {
      ...invalidMetricContent,
      resultHash: SHA_A,
    };
    expect(violationOf(() => candidateRun(scope(), [invalidMetric]))).toBe(
      'INVALID_METRIC_EVIDENCE',
    );
  });

  it('contains no threshold, winner, ranking, superiority, score, or recommendation output', () => {
    const result = comparable();
    const keys = collectKeys(result);
    expect(keys).not.toEqual(
      expect.arrayContaining([
        'threshold',
        'winner',
        'ranking',
        'superiority',
        'score',
        'recommendation',
        'pass',
        'fail',
      ]),
    );
    const injected = definitionInput() as unknown as Record<string, unknown>;
    injected.winner = 'candidate';
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          injected as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('PROHIBITED_SEMANTICS');
  });

  it('reports each reachable pairing and evidence reason code explicitly', () => {
    const definition = createD11BaselineDefinition(definitionInput());

    const runWith = (overrides: Partial<D11BaselineScope>) =>
      compareD11EvaluationRuns({
        comparatorId: 'd11-descriptive-comparator',
        comparatorVersion: '1.0.0',
        candidateRun: candidateRun(scope(overrides)),
        baselineDefinition: definition,
        baselineAuthority: authority(definition),
        baselineRun: baselineRun(definition),
      });

    expect(runWith({ metric: 'COVERAGE_MISSINGNESS' })).toMatchObject({
      status: 'NOT_COMPARABLE',
      reasons: ['METRIC_MISMATCH'],
    });
    expect(runWith({ targetOutput: 'other-output' })).toMatchObject({
      status: 'NOT_COMPARABLE',
      reasons: ['TARGET_OUTPUT_MISMATCH'],
    });
    expect(
      runWith({
        construct: { applicability: 'APPLICABLE', value: 'other-construct' },
      }),
    ).toMatchObject({
      status: 'NOT_COMPARABLE',
      reasons: ['CONSTRUCT_MISMATCH'],
    });
    expect(
      runWith({ observationUnit: 'other-observation-unit' }),
    ).toMatchObject({
      status: 'NOT_COMPARABLE',
      reasons: ['OBSERVATION_UNIT_MISMATCH'],
    });
    expect(
      runWith({
        parameterConfigurationIdentity: {
          applicability: 'APPLICABLE',
          value: { ...PARAMETER_IDENTITY, hash: SHA_D },
        },
      }),
    ).toMatchObject({
      status: 'NOT_COMPARABLE',
      reasons: ['PARAMETER_CONFIGURATION_MISMATCH'],
    });

    // A run bound to a different definition than the governed one fails closed.
    const otherDefinition = createD11BaselineDefinition(
      definitionInput({
        baselineId: 'second-governed-constant-reference',
        configuration: { kind: 'CONSTANT', targetValues: { joy: 0.67 } },
      }),
    );
    expect(
      compareD11EvaluationRuns({
        comparatorId: 'd11-descriptive-comparator',
        comparatorVersion: '1.0.0',
        candidateRun: candidateRun(definition.scope),
        baselineDefinition: definition,
        baselineAuthority: authority(definition),
        baselineRun: baselineRun(otherDefinition),
      }),
    ).toMatchObject({
      status: 'NOT_EVALUABLE',
      reasons: ['BASELINE_DEFINITION_BINDING_MISMATCH'],
    });

    // Metric evidence that does not cover the governed metric/dimension is a
    // missing required input, never a zero.
    expect(
      compareD11EvaluationRuns({
        comparatorId: 'd11-descriptive-comparator',
        comparatorVersion: '1.0.0',
        candidateRun: candidateRun(definition.scope, [
          metric('COMPUTED', 'fear'),
        ]),
        baselineDefinition: definition,
        baselineAuthority: authority(definition),
        baselineRun: baselineRun(definition),
      }),
    ).toMatchObject({
      status: 'NOT_EVALUABLE',
      reasons: ['REQUIRED_INPUT_MISSING'],
    });
  });

  it('reports a candidate ablation model identity mismatch without executing an ablation', () => {
    const definition = createD11BaselineDefinition(ablationInput());
    const result = compareD11EvaluationRuns({
      comparatorId: 'd11-descriptive-comparator',
      comparatorVersion: '1.0.0',
      candidateRun: candidateRun(
        scope({
          modelIdentity: {
            applicability: 'APPLICABLE',
            value: { ...MODEL_IDENTITY, hash: SHA_D },
          },
          parameterConfigurationIdentity: {
            applicability: 'APPLICABLE',
            value: PARAMETER_IDENTITY,
          },
        }),
      ),
      baselineDefinition: definition,
      baselineAuthority: authority(definition),
      baselineRun: baselineRun(definition),
    });
    expect(result).toMatchObject({
      status: 'NOT_COMPARABLE',
      reasons: ['MODEL_IDENTITY_MISMATCH'],
    });
    expect(Object.keys(D11)).not.toContain('executeD11DeterministicAblation');
  });

  it('rejects prohibited free-text semantics without rejecting legitimate documentation', () => {
    for (const justification of [
      'candidate improvement over the reference',
      'model selection evidence',
      'composite score reference',
      'baseline ranking record',
    ]) {
      expect(
        violationOf(() =>
          createD11BaselineDefinition(definitionInput({ justification })),
        ),
      ).toBe('PROHIBITED_SEMANTICS');
    }

    // Ordinary governance wording remains accepted.
    expect(
      createD11BaselineDefinition(
        definitionInput({
          justification:
            'Governed predefined contextual reference declared before evaluation.',
        }),
      ).justification,
    ).toBe(
      'Governed predefined contextual reference declared before evaluation.',
    );

    const injected = definitionInput() as unknown as Record<string, unknown>;
    injected.compositeScore = 0.5;
    expect(
      violationOf(() =>
        createD11BaselineDefinition(
          injected as unknown as D11BaselineDefinitionInput,
        ),
      ),
    ).toBe('PROHIBITED_SEMANTICS');
  });

  it('preserves D09 metrics, D10 no-threshold state, and Phase 6.15 boundaries', () => {
    expect(D09_ACTIVE_METRICS).toEqual([
      'PEARSON_R',
      'DESCRIPTIVE_DISTRIBUTIONS',
      'COVERAGE_MISSINGNESS',
    ]);
    expect(D10_THRESHOLD_METHODOLOGY_1_0_0.status).toBe('NO_THRESHOLD_DEFINED');
    expect(EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0).toMatchObject({
      status: 'UNRESOLVED',
      execution: 'NOT_IMPLEMENTED',
      humanData: 'NONE',
    });
  });
});

function comparableWith(
  definition: D11BaselineDefinitionArtifact,
): D11ComparisonArtifact {
  return compareD11EvaluationRuns({
    comparatorId: 'd11-descriptive-comparator',
    comparatorVersion: '1.0.0',
    candidateRun: candidateRun(definition.scope),
    baselineDefinition: definition,
    baselineAuthority: authority(definition),
    baselineRun: baselineRun(definition),
  });
}
