import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_FAMILIES_BY_COMPONENT,
  COMPATIBILITY_AXES,
  MATHEMATICAL_COMPONENTS,
  MATHEMATICAL_DECISION_REGISTER_1_0_0,
} from './contracts';
import type {
  CandidateComparisonArtifactInput,
  CandidateFormulationRecord,
  CompatibilityProfile,
  MathematicalComponent,
  SourceProvenance,
} from './contracts';
import {
  CandidateComparisonValidationError,
  createCandidateComparisonArtifact,
} from './validation';

const completeVerifiedProvenance: SourceProvenance = {
  sourceStatus: 'VERIFIED',
  interpretation: 'DESCRIPTIVE',
  verificationBasis: 'CALLER_DECLARED_ORIGINAL_SOURCE_INSPECTION',
  verifiedBy: 'reviewer-a',
  sourceTitle: 'Title',
  authors: ['Author'],
  year: 2001,
  publication: 'Journal',
  equationReference: 'Eq. 3',
  section: '2.1',
};

const unknownCompatibility: CompatibilityProfile = Object.fromEntries(
  COMPATIBILITY_AXES.map((axis) => [axis, { value: 'UNKNOWN' as const }]),
) as CompatibilityProfile;

function qualifiersFor(component: MathematicalComponent) {
  switch (component) {
    case 'INTENSITY':
      return { intensityConstruct: 'EMOTIONAL_STATE_INTENSITY' as const };
    case 'MEMORY':
      return { memoryConstruct: 'EMOTIONAL_MEMORY' as const };
    case 'INTERACTION_MATRIX':
      return { relationKind: 'COUPLING' as const };
    default:
      return {};
  }
}

function candidate<C extends MathematicalComponent>(
  component: C,
  candidateId: string,
  overrides: Partial<CandidateFormulationRecord<C>> = {},
): CandidateFormulationRecord<C> {
  return {
    candidateId,
    component,
    family: CANDIDATE_FAMILIES_BY_COMPONENT[
      component
    ][0] as CandidateFormulationRecord<C>['family'],
    label: `Candidate ${candidateId}`,
    provenance: { sourceStatus: 'UNVERIFIED', interpretation: 'NOT_REPORTED' },
    equation: {
      expression: 'y = f(x)',
      variables: [
        {
          symbol: 'x',
          definition: 'input',
          unitsOrScale: 'dimensionless [0,1]',
        },
      ],
    },
    constructMapping: {
      emoraConstruct: 'EMORA construct',
      candidateConstruct: 'candidate construct',
      qualifiers: qualifiersFor(component),
    },
    inputs: ['x'],
    outputs: ['y'],
    scale: 'dimensionless',
    temporalAssumptions: 'instantaneous',
    parameterAssumptions: 'none',
    compatibility: unknownCompatibility,
    evidenceTypes: ['MATHEMATICAL'],
    limitations: [],
    syntheticEvaluation: {
      evidenceClass: 'SYNTHETIC_MATHEMATICAL',
      requirements: [
        { kind: 'BOUNDEDNESS', description: 'Output stays in [0,1].' },
      ],
    },
    humanEvaluation: {
      evidenceClass: 'HUMAN_BEHAVIORAL',
      requirements: [
        {
          kind: 'TARGET_CONSTRUCT',
          description: 'Define the human construct.',
        },
      ],
    },
    revisitTriggers: [],
    analyticalObservations: [],
    ...overrides,
  };
}

function artifactInput<C extends MathematicalComponent>(
  component: C,
  candidates: readonly CandidateFormulationRecord<C>[],
): CandidateComparisonArtifactInput<C> {
  return {
    artifactId: `${component.toLowerCase()}-comparison`,
    artifactVersion: '1.0.0',
    component,
    governedDecisionReference: {
      registerVersion: '1.0.0',
      ...MATHEMATICAL_DECISION_REGISTER_1_0_0[component],
    },
    currentFormulationSummary:
      'Current EMORA formulation as recorded in the register.',
    candidates,
  };
}

function violationOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(CandidateComparisonValidationError);
    return (error as CandidateComparisonValidationError).violation;
  }
}

describe('Phase 6.13 candidate comparison identity', () => {
  it('accepts one artifact per component with explicit component and family', () => {
    for (const component of MATHEMATICAL_COMPONENTS) {
      const artifact = createCandidateComparisonArtifact(
        artifactInput(component, [candidate(component, 'c-1')]),
      );
      expect(artifact.component).toBe(component);
      expect(artifact.candidates[0]?.component).toBe(component);
      expect(artifact.candidates[0]?.family).toBe(
        CANDIDATE_FAMILIES_BY_COMPONENT[component][0],
      );
      expect(artifact.scope).toBe('READ_ONLY_ANALYTICAL');
    }
  });

  it('rejects duplicate candidate ids within a component', () => {
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('VALENCE', [
            candidate('VALENCE', 'dup'),
            candidate('VALENCE', 'dup'),
          ]),
        ),
      ),
    ).toBe('DUPLICATE_CANDIDATE_ID');
  });

  it('rejects a candidate whose component differs from the artifact component', () => {
    const foreign = candidate(
      'AROUSAL',
      'c-1',
    ) as unknown as CandidateFormulationRecord<'VALENCE'>;
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(artifactInput('VALENCE', [foreign])),
      ),
    ).toBe('COMPONENT_MISMATCH');
  });

  it('rejects a family that does not belong to the component', () => {
    const wrongFamily = candidate('VALENCE', 'c-1', {
      family:
        'EXPONENTIAL_DECAY' as unknown as CandidateFormulationRecord<'VALENCE'>['family'],
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('VALENCE', [wrongFamily]),
        ),
      ),
    ).toBe('INVALID_FAMILY');
  });

  it('rejects an unknown component', () => {
    const input = artifactInput('VALENCE', [candidate('VALENCE', 'c-1')]);
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact({
          ...input,
          component: 'MOOD' as unknown as 'VALENCE',
        }),
      ),
    ).toBe('INVALID_COMPONENT');
  });
});

describe('Phase 6.13 provenance', () => {
  it('rejects an invalid source status', () => {
    const invalid = candidate('EVENT_IMPACT', 'c-1', {
      provenance: {
        sourceStatus: 'CITED' as unknown as 'VERIFIED',
        interpretation: 'NOT_REPORTED',
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('EVENT_IMPACT', [invalid]),
        ),
      ),
    ).toBe('INVALID_SOURCE_STATUS');
  });

  it('rejects VERIFIED provenance that omits required verification metadata', () => {
    const omit = (field: keyof SourceProvenance) => {
      const { [field]: _dropped, ...rest } = completeVerifiedProvenance;
      void _dropped;
      return rest as SourceProvenance;
    };
    for (const field of [
      'verificationBasis',
      'verifiedBy',
      'sourceTitle',
      'authors',
      'year',
      'publication',
      'equationReference',
      'section',
    ] as const) {
      const partial = candidate('EVENT_IMPACT', 'c-1', {
        provenance: omit(field),
      });
      expect(
        violationOf(() =>
          createCandidateComparisonArtifact(
            artifactInput('EVENT_IMPACT', [partial]),
          ),
        ),
        `missing ${field}`,
      ).toBe('INCOMPLETE_VERIFICATION');
    }
  });

  it('rejects an unknown verification basis and verification fields on non-VERIFIED sources', () => {
    const unknownBasis = candidate('EVENT_IMPACT', 'c-1', {
      provenance: {
        ...completeVerifiedProvenance,
        verificationBasis:
          'INDEPENDENTLY_VERIFIED_BY_VALIDATOR' as unknown as SourceProvenance['verificationBasis'],
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('EVENT_IMPACT', [unknownBasis]),
        ),
      ),
    ).toBe('INCOMPLETE_VERIFICATION');
    const unverifiedWithBasis = candidate('EVENT_IMPACT', 'c-1', {
      provenance: {
        sourceStatus: 'UNVERIFIED',
        interpretation: 'NOT_REPORTED',
        verificationBasis: 'CALLER_DECLARED_ORIGINAL_SOURCE_INSPECTION',
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('EVENT_IMPACT', [unverifiedWithBasis]),
        ),
      ),
    ).toBe('INCOMPLETE_VERIFICATION');
  });

  it('accepts VERIFIED provenance with complete metadata and records the caller-declared basis', () => {
    const verified = candidate('EVENT_IMPACT', 'c-1', {
      provenance: completeVerifiedProvenance,
    });
    const artifact = createCandidateComparisonArtifact(
      artifactInput('EVENT_IMPACT', [verified]),
    );
    expect(artifact.candidates[0]?.provenance.sourceStatus).toBe('VERIFIED');
    expect(artifact.candidates[0]?.provenance.verificationBasis).toBe(
      'CALLER_DECLARED_ORIGINAL_SOURCE_INSPECTION',
    );
  });

  it('records equations for UNVERIFIED, NOT_LOCATED, and NOT_REPORTED sources without upgrading them', () => {
    for (const sourceStatus of [
      'UNVERIFIED',
      'NOT_LOCATED',
      'NOT_REPORTED',
      'NOT_APPLICABLE',
    ] as const) {
      const artifact = createCandidateComparisonArtifact(
        artifactInput('MEMORY', [
          candidate('MEMORY', 'c-1', {
            provenance: { sourceStatus, interpretation: 'NOT_REPORTED' },
          }),
        ]),
      );
      expect(artifact.candidates[0]?.provenance.sourceStatus).toBe(
        sourceStatus,
      );
      expect(artifact.candidates[0]?.equation.expression).toBe('y = f(x)');
    }
  });

  it('rejects an invalid interpretation', () => {
    const invalid = candidate('EVENT_IMPACT', 'c-1', {
      provenance: {
        sourceStatus: 'UNVERIFIED',
        interpretation: 'PROVEN' as unknown as 'CAUSAL',
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('EVENT_IMPACT', [invalid]),
        ),
      ),
    ).toBe('INVALID_SHAPE');
  });

  it('accepts UNVERIFIED provenance without source details', () => {
    const artifact = createCandidateComparisonArtifact(
      artifactInput('MEMORY', [candidate('MEMORY', 'c-1')]),
    );
    expect(artifact.candidates[0]?.provenance).toEqual({
      sourceStatus: 'UNVERIFIED',
      interpretation: 'NOT_REPORTED',
    });
  });
});

describe('Phase 6.13 compatibility', () => {
  it('rejects a compatibility value outside the allowed vocabulary', () => {
    const invalid = candidate('AROUSAL', 'c-1', {
      compatibility: {
        ...unknownCompatibility,
        scale: { value: 'MOSTLY_COMPATIBLE' as unknown as 'COMPATIBLE' },
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(artifactInput('AROUSAL', [invalid])),
      ),
    ).toBe('INVALID_COMPATIBILITY');
  });

  it('rejects numeric compatibility on any axis', () => {
    const numeric = candidate('AROUSAL', 'c-1', {
      compatibility: {
        ...unknownCompatibility,
        construct: 0.85 as unknown as { value: 'COMPATIBLE' },
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(artifactInput('AROUSAL', [numeric])),
      ),
    ).toBe('INVALID_COMPATIBILITY');
  });

  it('requires every axis and rejects a compatibility score field', () => {
    const { construct: _omitted, ...missing } = unknownCompatibility;
    void _omitted;
    const incomplete = candidate('AROUSAL', 'c-1', {
      compatibility: missing as unknown as CompatibilityProfile,
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('AROUSAL', [incomplete]),
        ),
      ),
    ).toBe('INVALID_COMPATIBILITY');

    const scored = candidate('AROUSAL', 'c-1', {
      compatibility: {
        ...unknownCompatibility,
        compatibilityScore: 1,
      } as unknown as CompatibilityProfile,
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(artifactInput('AROUSAL', [scored])),
      ),
    ).toBe('FORBIDDEN_FIELD');
  });

  it('preserves mixed compatibility across axes without aggregation', () => {
    const mixed = candidate('TEMPORAL_DYNAMICS', 'c-1', {
      compatibility: {
        ...unknownCompatibility,
        construct: {
          value: 'PARTIALLY_COMPATIBLE',
          observation: 'Continuous time vs discrete step.',
        },
        computational: { value: 'INCOMPATIBLE' },
        interpretability: { value: 'COMPATIBLE' },
      },
    });
    const artifact = createCandidateComparisonArtifact(
      artifactInput('TEMPORAL_DYNAMICS', [mixed]),
    );
    const compatibility = artifact.candidates[0]!.compatibility;
    expect(compatibility.construct.value).toBe('PARTIALLY_COMPATIBLE');
    expect(compatibility.computational.value).toBe('INCOMPATIBLE');
    expect(compatibility.interpretability.value).toBe('COMPATIBLE');
    expect(compatibility.scale.value).toBe('UNKNOWN');
    expect(Object.keys(compatibility).sort()).toEqual(
      [...COMPATIBILITY_AXES].sort(),
    );
    for (const axis of COMPATIBILITY_AXES) {
      expect(typeof compatibility[axis].value).toBe('string');
    }
  });
});

describe('Phase 6.13 evidence', () => {
  it('rejects an evidence type outside the taxonomy', () => {
    const invalid = candidate('INTENSITY', 'c-1', {
      evidenceTypes: ['ANECDOTAL' as unknown as 'MATHEMATICAL'],
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('INTENSITY', [invalid]),
        ),
      ),
    ).toBe('INVALID_EVIDENCE_TYPE');
  });

  it('stores evidence types as descriptive labels only', () => {
    const artifact = createCandidateComparisonArtifact(
      artifactInput('INTENSITY', [
        candidate('INTENSITY', 'c-1', {
          evidenceTypes: ['MATHEMATICAL', 'THEORETICAL'],
        }),
        candidate('INTENSITY', 'c-2', { evidenceTypes: ['EMPIRICAL'] }),
      ]),
    );
    for (const record of artifact.candidates) {
      expect(
        record.evidenceTypes.every((type) => typeof type === 'string'),
      ).toBe(true);
      expect(record).not.toHaveProperty('evidenceScore');
      expect(record).not.toHaveProperty('scientificScore');
      expect(record).not.toHaveProperty('candidateRank');
    }
  });

  it('rejects evidence score fields anywhere on the candidate', () => {
    const scored = candidate('INTENSITY', 'c-1');
    const withScore = {
      ...scored,
      evidenceScore: 0.9,
    } as unknown as CandidateFormulationRecord<'INTENSITY'>;
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('INTENSITY', [withScore]),
        ),
      ),
    ).toBe('FORBIDDEN_FIELD');
  });
});

describe('Phase 6.13 construct separation', () => {
  it('requires an explicit event vs state intensity qualifier for INTENSITY', () => {
    const unqualified = candidate('INTENSITY', 'c-1', {
      constructMapping: {
        emoraConstruct: 'x',
        candidateConstruct: 'y',
        qualifiers: {},
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('INTENSITY', [unqualified]),
        ),
      ),
    ).toBe('INVALID_CONSTRUCT_QUALIFIER');

    const artifact = createCandidateComparisonArtifact(
      artifactInput('INTENSITY', [
        candidate('INTENSITY', 'event', {
          constructMapping: {
            emoraConstruct: 'event.intensity',
            candidateConstruct: 'y',
            qualifiers: { intensityConstruct: 'EVENT_INTENSITY' },
          },
        }),
        candidate('INTENSITY', 'state', {
          constructMapping: {
            emoraConstruct: 'state.dimensions.intensity',
            candidateConstruct: 'y',
            qualifiers: { intensityConstruct: 'EMOTIONAL_STATE_INTENSITY' },
          },
        }),
      ]),
    );
    expect(
      artifact.candidates.map(
        (record) => record.constructMapping.qualifiers.intensityConstruct,
      ),
    ).toEqual(['EVENT_INTENSITY', 'EMOTIONAL_STATE_INTENSITY']);
  });

  it('requires an explicit memory construct for MEMORY and keeps declarative and emotional memory distinct', () => {
    const unqualified = candidate('MEMORY', 'c-1', {
      constructMapping: {
        emoraConstruct: 'x',
        candidateConstruct: 'y',
        qualifiers: {},
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('MEMORY', [unqualified]),
        ),
      ),
    ).toBe('INVALID_CONSTRUCT_QUALIFIER');

    const artifact = createCandidateComparisonArtifact(
      artifactInput('MEMORY', [
        candidate('MEMORY', 'declarative', {
          constructMapping: {
            emoraConstruct: 'x',
            candidateConstruct: 'retention',
            qualifiers: { memoryConstruct: 'DECLARATIVE_MEMORY' },
          },
        }),
        candidate('MEMORY', 'emotional', {
          constructMapping: {
            emoraConstruct: 'x',
            candidateConstruct: 'affective persistence',
            qualifiers: { memoryConstruct: 'EMOTIONAL_MEMORY' },
          },
        }),
        candidate('MEMORY', 'inertia', {
          constructMapping: {
            emoraConstruct: 'x',
            candidateConstruct: 'inertia',
            qualifiers: { memoryConstruct: 'EMOTIONAL_PERSISTENCE_INERTIA' },
          },
        }),
      ]),
    );
    expect(
      new Set(
        artifact.candidates.map(
          (record) => record.constructMapping.qualifiers.memoryConstruct,
        ),
      ).size,
    ).toBe(3);
  });

  it('rejects a qualifier that belongs to another component', () => {
    const misplaced = candidate('VALENCE', 'c-1', {
      constructMapping: {
        emoraConstruct: 'x',
        candidateConstruct: 'y',
        qualifiers: { memoryConstruct: 'EMOTIONAL_MEMORY' },
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('VALENCE', [misplaced]),
        ),
      ),
    ).toBe('INVALID_CONSTRUCT_QUALIFIER');
  });

  it('keeps coupling and causality distinct and never upgrades coupling to a causal claim', () => {
    const coupling = candidate('INTERACTION_MATRIX', 'coupling', {
      constructMapping: {
        emoraConstruct: 'W[source,target]',
        candidateConstruct: 'edge weight',
        qualifiers: { relationKind: 'COUPLING' },
      },
    });
    const association = candidate('INTERACTION_MATRIX', 'association', {
      constructMapping: {
        emoraConstruct: 'W[source,target]',
        candidateConstruct: 'partial correlation',
        qualifiers: { relationKind: 'ASSOCIATION' },
      },
    });
    const artifact = createCandidateComparisonArtifact(
      artifactInput('INTERACTION_MATRIX', [coupling, association]),
    );
    expect(
      artifact.candidates.map(
        (record) => record.constructMapping.qualifiers.relationKind,
      ),
    ).toEqual(['COUPLING', 'ASSOCIATION']);

    const unverifiedCausal = candidate('INTERACTION_MATRIX', 'causal', {
      constructMapping: {
        emoraConstruct: 'x',
        candidateConstruct: 'y',
        qualifiers: { relationKind: 'CAUSALITY' },
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('INTERACTION_MATRIX', [unverifiedCausal]),
        ),
      ),
    ).toBe('UNSUPPORTED_CAUSAL_CLAIM');

    const verifiedButDescriptive = candidate('INTERACTION_MATRIX', 'causal', {
      provenance: {
        ...completeVerifiedProvenance,
        interpretation: 'DESCRIPTIVE',
      },
      constructMapping: {
        emoraConstruct: 'x',
        candidateConstruct: 'y',
        qualifiers: { relationKind: 'CAUSALITY' },
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('INTERACTION_MATRIX', [verifiedButDescriptive]),
        ),
      ),
    ).toBe('UNSUPPORTED_CAUSAL_CLAIM');

    const verifiedCausal = candidate('INTERACTION_MATRIX', 'causal', {
      provenance: { ...completeVerifiedProvenance, interpretation: 'CAUSAL' },
      constructMapping: {
        emoraConstruct: 'x',
        candidateConstruct: 'y',
        qualifiers: { relationKind: 'CAUSALITY' },
      },
    });
    const recorded = createCandidateComparisonArtifact(
      artifactInput('INTERACTION_MATRIX', [verifiedCausal]),
    );
    expect(
      recorded.candidates[0]?.constructMapping.qualifiers.relationKind,
    ).toBe('CAUSALITY');
  });
});

describe('Phase 6.13 synthetic/human separation', () => {
  it('rejects synthetic evaluation metadata labelled as human evidence', () => {
    const mislabelled = candidate('PERSONALITY_MODIFIER', 'c-1', {
      syntheticEvaluation: {
        evidenceClass:
          'HUMAN_BEHAVIORAL' as unknown as 'SYNTHETIC_MATHEMATICAL',
        requirements: [{ kind: 'BOUNDEDNESS', description: 'x' }],
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('PERSONALITY_MODIFIER', [mislabelled]),
        ),
      ),
    ).toBe('EVIDENCE_CLASS_MISMATCH');
  });

  it('rejects human evaluation metadata labelled as synthetic evidence', () => {
    const mislabelled = candidate('PERSONALITY_MODIFIER', 'c-1', {
      humanEvaluation: {
        evidenceClass:
          'SYNTHETIC_MATHEMATICAL' as unknown as 'HUMAN_BEHAVIORAL',
        requirements: [{ kind: 'TARGET_CONSTRUCT', description: 'x' }],
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('PERSONALITY_MODIFIER', [mislabelled]),
        ),
      ),
    ).toBe('EVIDENCE_CLASS_MISMATCH');
  });

  it('rejects requirement kinds that cross the synthetic/human boundary', () => {
    const humanKindInSynthetic = candidate('PERSONALITY_MODIFIER', 'c-1', {
      syntheticEvaluation: {
        evidenceClass: 'SYNTHETIC_MATHEMATICAL',
        requirements: [
          {
            kind: 'INTER_RATER_VARIABILITY' as unknown as 'BOUNDEDNESS',
            description: 'x',
          },
        ],
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('PERSONALITY_MODIFIER', [humanKindInSynthetic]),
        ),
      ),
    ).toBe('EVIDENCE_CLASS_MISMATCH');

    const syntheticKindInHuman = candidate('PERSONALITY_MODIFIER', 'c-1', {
      humanEvaluation: {
        evidenceClass: 'HUMAN_BEHAVIORAL',
        requirements: [
          {
            kind: 'DETERMINISM' as unknown as 'TARGET_CONSTRUCT',
            description: 'x',
          },
        ],
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('PERSONALITY_MODIFIER', [syntheticKindInHuman]),
        ),
      ),
    ).toBe('EVIDENCE_CLASS_MISMATCH');
  });

  it('rejects unknown evidence classes and unknown requirement kinds', () => {
    const unknownClass = candidate('PERSONALITY_MODIFIER', 'c-1', {
      syntheticEvaluation: {
        evidenceClass:
          'PSYCHOLOGICAL_VALIDITY' as unknown as 'SYNTHETIC_MATHEMATICAL',
        requirements: [],
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('PERSONALITY_MODIFIER', [unknownClass]),
        ),
      ),
    ).toBe('EVIDENCE_CLASS_MISMATCH');

    const unknownKind = candidate('PERSONALITY_MODIFIER', 'c-1', {
      humanEvaluation: {
        evidenceClass: 'HUMAN_BEHAVIORAL',
        requirements: [
          {
            kind: 'P_VALUE' as unknown as 'TARGET_CONSTRUCT',
            description: 'x',
          },
        ],
      },
    });
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('PERSONALITY_MODIFIER', [unknownKind]),
        ),
      ),
    ).toBe('EVIDENCE_CLASS_MISMATCH');
  });
});

describe('Phase 6.13 candidate neutrality', () => {
  it('lets multiple candidates coexist without selection, ranking, winner, or superiority fields', () => {
    const artifact = createCandidateComparisonArtifact(
      artifactInput('HYBRID_FUSION', [
        candidate('HYBRID_FUSION', 'convex', { family: 'CONVEX_FUSION' }),
        candidate('HYBRID_FUSION', 'mixture', { family: 'MIXTURE_MODEL' }),
        candidate('HYBRID_FUSION', 'ensemble', { family: 'ENSEMBLE' }),
      ]),
    );
    expect(artifact.candidates).toHaveLength(3);
    for (const field of [
      'winner',
      'rank',
      'ranking',
      'score',
      'superiority',
      'selected',
      'recommendation',
      'decision',
    ]) {
      expect(artifact).not.toHaveProperty(field);
      for (const record of artifact.candidates)
        expect(record).not.toHaveProperty(field);
    }
    expect(artifact.governedDecisionReference.currentDecision).toBe('DEFER');
  });

  it('rejects ranking, winner, and selection fields at artifact or candidate level', () => {
    const base = artifactInput('VALENCE', [
      candidate('VALENCE', 'c-1'),
      candidate('VALENCE', 'c-2'),
    ]);
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact({
          ...base,
          winner: 'c-1',
        } as typeof base),
      ),
    ).toBe('FORBIDDEN_FIELD');
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact({
          ...base,
          ranking: ['c-1', 'c-2'],
        } as typeof base),
      ),
    ).toBe('FORBIDDEN_FIELD');
    const ranked = {
      ...candidate('VALENCE', 'c-1'),
      rank: 1,
    } as unknown as CandidateFormulationRecord<'VALENCE'>;
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(artifactInput('VALENCE', [ranked])),
      ),
    ).toBe('FORBIDDEN_FIELD');
    const decided = {
      ...candidate('VALENCE', 'c-1'),
      decision: 'ADOPT',
    } as unknown as CandidateFormulationRecord<'VALENCE'>;
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(artifactInput('VALENCE', [decided])),
      ),
    ).toBe('FORBIDDEN_FIELD');
  });

  it('exposes no selection or scoring function', async () => {
    const module = await import('./index');
    for (const name of Object.keys(module)) {
      expect(name).not.toMatch(
        /select|rank|score|winner|recommend|optimi[sz]e/i,
      );
    }
  });

  it('keeps the governed decision as caller-supplied register metadata, frozen at 1.0.0', () => {
    const input = artifactInput('EVENT_IMPACT', [
      candidate('EVENT_IMPACT', 'c-1'),
    ]);
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact({
          ...input,
          governedDecisionReference: {
            registerVersion: '1.0.0',
            decisionId: 'MDR-001',
            currentDecision: 'ADOPT',
          },
        }),
      ),
    ).toBe('FROZEN_DECISION_MISMATCH');
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact({
          ...input,
          governedDecisionReference: {
            registerVersion: '1.0.0',
            decisionId: 'MDR-002',
            currentDecision: 'RETAIN',
          },
        }),
      ),
    ).toBe('FROZEN_DECISION_MISMATCH');
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact({
          ...input,
          governedDecisionReference: {
            registerVersion: '1.0.0',
            decisionId: 'MDR-001',
            currentDecision: 'KEEP' as unknown as 'RETAIN',
          },
        }),
      ),
    ).toBe('INVALID_GOVERNED_DECISION');
  });

  it('fails closed on an unknown register version instead of bypassing the frozen check', () => {
    const input = artifactInput('VALENCE', [candidate('VALENCE', 'c-1')]);
    for (const registerVersion of ['9.9.9', '1.0.1', '', 'latest']) {
      expect(
        violationOf(() =>
          createCandidateComparisonArtifact({
            ...input,
            governedDecisionReference: {
              registerVersion: registerVersion as '1.0.0',
              decisionId: 'MDR-003',
              currentDecision: 'ADOPT',
            },
          }),
        ),
        `registerVersion ${JSON.stringify(registerVersion)}`,
      ).toBe('UNKNOWN_REGISTER_VERSION');
    }
  });

  it('mirrors docs/mathematical-decision-register.md exactly (no silent divergence)', () => {
    const register = readFileSync(
      new URL(
        '../../../../docs/mathematical-decision-register.md',
        import.meta.url,
      ),
      'utf8',
    );
    expect(register).toMatch(/^\*\*Register version:\*\* 1\.0\.0$/m);

    const entries = [...register.matchAll(/^### (MDR-\d{3}) — (.+)$/gm)].map(
      (heading) => {
        const start = heading.index ?? 0;
        const body = register.slice(
          start,
          register.indexOf('\n### ', start + 1) === -1
            ? undefined
            : register.indexOf('\n### ', start + 1),
        );
        const decision =
          /\| \*\*Current Decision\*\* \| \*\*([A-Z]+)\*\* \|/.exec(body)?.[1];
        return {
          decisionId: heading[1],
          title: heading[2],
          currentDecision: decision,
        };
      },
    );
    expect(entries).toHaveLength(9);

    const titleToComponent: Record<string, MathematicalComponent> = {
      'Event Impact': 'EVENT_IMPACT',
      'Personality Modifier': 'PERSONALITY_MODIFIER',
      Valence: 'VALENCE',
      Arousal: 'AROUSAL',
      Intensity: 'INTENSITY',
      'Memory / Memory Decay': 'MEMORY',
      'Temporal Dynamics': 'TEMPORAL_DYNAMICS',
      'Emotion Interaction Matrix': 'INTERACTION_MATRIX',
      'Hybrid Fusion': 'HYBRID_FUSION',
    };
    const fromDocument = Object.fromEntries(
      entries.map((entry) => [
        titleToComponent[entry.title],
        {
          decisionId: entry.decisionId,
          currentDecision: entry.currentDecision,
        },
      ]),
    );
    expect(fromDocument).toEqual(MATHEMATICAL_DECISION_REGISTER_1_0_0);
  });

  it('encodes the frozen Phase 6.12 decisions exactly', () => {
    expect(MATHEMATICAL_DECISION_REGISTER_1_0_0).toEqual({
      EVENT_IMPACT: { decisionId: 'MDR-001', currentDecision: 'RETAIN' },
      PERSONALITY_MODIFIER: {
        decisionId: 'MDR-002',
        currentDecision: 'RETAIN',
      },
      VALENCE: { decisionId: 'MDR-003', currentDecision: 'RETAIN' },
      AROUSAL: { decisionId: 'MDR-004', currentDecision: 'RETAIN' },
      INTENSITY: { decisionId: 'MDR-005', currentDecision: 'RETAIN' },
      MEMORY: { decisionId: 'MDR-006', currentDecision: 'RETAIN' },
      TEMPORAL_DYNAMICS: { decisionId: 'MDR-007', currentDecision: 'RETAIN' },
      INTERACTION_MATRIX: { decisionId: 'MDR-008', currentDecision: 'RETAIN' },
      HYBRID_FUSION: { decisionId: 'MDR-009', currentDecision: 'DEFER' },
    });
  });
});

describe('Phase 6.13 determinism', () => {
  it('produces identical frozen artifacts and hashes for identical inputs', () => {
    const build = () =>
      createCandidateComparisonArtifact(
        artifactInput('MEMORY', [
          candidate('MEMORY', 'exp', { family: 'EXPONENTIAL_DECAY' }),
          candidate('MEMORY', 'power', { family: 'POWER_LAW_FORGETTING' }),
        ]),
      );
    const first = build();
    const second = build();
    expect(first).toEqual(second);
    expect(first.artifactHash).toBe(second.artifactHash);
    expect(first.artifactHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.candidates)).toBe(true);
    expect(Object.isFrozen(first.candidates[0]!.compatibility)).toBe(true);
  });

  it('preserves supplied candidate order and changes the hash when content changes', () => {
    const a = candidate('MEMORY', 'a');
    const b = candidate('MEMORY', 'b');
    const forward = createCandidateComparisonArtifact(
      artifactInput('MEMORY', [a, b]),
    );
    const reversed = createCandidateComparisonArtifact(
      artifactInput('MEMORY', [b, a]),
    );
    expect(forward.candidates.map((record) => record.candidateId)).toEqual([
      'a',
      'b',
    ]);
    expect(reversed.candidates.map((record) => record.candidateId)).toEqual([
      'b',
      'a',
    ]);
    expect(forward.artifactHash).not.toBe(reversed.artifactHash);
  });

  it('does not alias caller input', () => {
    const input = artifactInput('AROUSAL', [candidate('AROUSAL', 'c-1')]);
    const artifact = createCandidateComparisonArtifact(input);
    expect(artifact.candidates).not.toBe(input.candidates);
    expect(Object.isFrozen(input.candidates)).toBe(false);
  });

  it('is unaffected by input mutation after creation and rejects output mutation', () => {
    const mutableCandidate = candidate('AROUSAL', 'c-1', {
      // Fresh copy so mutation below cannot leak into the shared fixture.
      compatibility: JSON.parse(
        JSON.stringify(unknownCompatibility),
      ) as CompatibilityProfile,
    }) as { label: string; compatibility: { construct: { value: string } } };
    const candidates = [
      mutableCandidate as unknown as CandidateFormulationRecord<'AROUSAL'>,
    ];
    const artifact = createCandidateComparisonArtifact(
      artifactInput('AROUSAL', candidates),
    );
    const originalHash = artifact.artifactHash;

    mutableCandidate.label = 'MUTATED';
    mutableCandidate.compatibility.construct.value = 'COMPATIBLE';
    candidates.push(candidate('AROUSAL', 'c-2'));
    expect(artifact.candidates).toHaveLength(1);
    expect(artifact.candidates[0]!.label).toBe('Candidate c-1');
    expect(artifact.candidates[0]!.compatibility.construct.value).toBe(
      'UNKNOWN',
    );
    expect(artifact.artifactHash).toBe(originalHash);

    const writable = artifact as unknown as {
      artifactHash: string;
      candidates: { label: string }[];
    };
    expect(() => {
      writable.artifactHash = 'tampered';
    }).toThrow(TypeError);
    expect(() => {
      writable.candidates[0]!.label = 'tampered';
    }).toThrow(TypeError);
    expect(() => {
      writable.candidates.push({ label: 'extra' });
    }).toThrow(TypeError);
    expect(artifact.artifactHash).toBe(originalHash);
    expect(artifact.candidates[0]!.label).toBe('Candidate c-1');
  });

  it('hashes canonically so key order does not matter and no volatile fields are included', () => {
    const input = artifactInput('AROUSAL', [candidate('AROUSAL', 'c-1')]);
    const reordered = Object.fromEntries(
      Object.entries(input).reverse(),
    ) as typeof input;
    const first = createCandidateComparisonArtifact(input);
    const second = createCandidateComparisonArtifact(reordered);
    expect(second.artifactHash).toBe(first.artifactHash);
    expect(Object.keys(first).sort()).toEqual([
      'artifactHash',
      'artifactId',
      'artifactVersion',
      'candidates',
      'component',
      'currentFormulationSummary',
      'governedDecisionReference',
      'scope',
    ]);
  });
});

describe('Phase 6.13 unknown-field rejection', () => {
  const base = () => candidate('VALENCE', 'c-1');
  const build = (record: unknown) =>
    createCandidateComparisonArtifact(
      artifactInput('VALENCE', [
        record as CandidateFormulationRecord<'VALENCE'>,
      ]),
    );

  it.each([
    ['candidate', () => ({ ...base(), note: 'x' })],
    [
      'provenance',
      () => ({ ...base(), provenance: { ...base().provenance, citedBy: 'x' } }),
    ],
    [
      'equation',
      () => ({ ...base(), equation: { ...base().equation, latex: 'x' } }),
    ],
    [
      'equation variable',
      () => ({
        ...base(),
        equation: {
          expression: 'y',
          variables: [
            { symbol: 'x', definition: 'd', unitsOrScale: 'u', range: '[0,1]' },
          ],
        },
      }),
    ],
    [
      'compatibility assessment',
      () => ({
        ...base(),
        compatibility: {
          ...unknownCompatibility,
          scale: { value: 'UNKNOWN', weight: 1 },
        },
      }),
    ],
    [
      'construct mapping',
      () => ({
        ...base(),
        constructMapping: { ...base().constructMapping, theory: 'x' },
      }),
    ],
    [
      'construct qualifiers',
      () => ({
        ...base(),
        constructMapping: {
          ...base().constructMapping,
          qualifiers: { valenceKind: 'x' },
        },
      }),
    ],
    [
      'synthetic plan',
      () => ({
        ...base(),
        syntheticEvaluation: { ...base().syntheticEvaluation, passed: true },
      }),
    ],
    [
      'synthetic requirement',
      () => ({
        ...base(),
        syntheticEvaluation: {
          evidenceClass: 'SYNTHETIC_MATHEMATICAL',
          requirements: [
            { kind: 'BOUNDEDNESS', description: 'd', result: 'PASS' },
          ],
        },
      }),
    ],
    [
      'human plan',
      () => ({
        ...base(),
        humanEvaluation: { ...base().humanEvaluation, validity: 'HIGH' },
      }),
    ],
    [
      'human requirement',
      () => ({
        ...base(),
        humanEvaluation: {
          evidenceClass: 'HUMAN_BEHAVIORAL',
          requirements: [
            { kind: 'TARGET_CONSTRUCT', description: 'd', pValue: 0.01 },
          ],
        },
      }),
    ],
  ])('rejects an unknown field in %s', (_label, make) => {
    expect(violationOf(() => build(make()))).toBe('INVALID_SHAPE');
  });

  it('rejects unknown fields on the artifact and on the governed decision reference', () => {
    const input = artifactInput('VALENCE', [base()]);
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact({
          ...input,
          notes: 'x',
        } as typeof input),
      ),
    ).toBe('INVALID_SHAPE');
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact({
          ...input,
          governedDecisionReference: {
            ...input.governedDecisionReference,
            proposedDecision: 'ADOPT',
          } as typeof input.governedDecisionReference,
        }),
      ),
    ).toBe('INVALID_SHAPE');
  });

  it('rejects executable object hooks before they can replace validated content', () => {
    let getterCalls = 0;
    const input = artifactInput('VALENCE', [base()]);
    const inheritedToJSON = Object.assign(
      Object.create({
        toJSON: () => ({
          ...input,
          governedDecisionReference: {
            registerVersion: '1.0.0',
            decisionId: 'MDR-003',
            currentDecision: 'ADOPT',
          },
          winner: 'c-1',
        }),
      }),
      input,
    ) as typeof input;
    expect(
      violationOf(() => createCandidateComparisonArtifact(inheritedToJSON)),
    ).toBe('INVALID_SHAPE');

    const accessor = { ...input } as typeof input;
    Object.defineProperty(accessor, 'artifactId', {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 'changed-by-getter';
      },
    });
    expect(violationOf(() => createCandidateComparisonArtifact(accessor))).toBe(
      'INVALID_SHAPE',
    );
    expect(getterCalls).toBe(0);
  });

  it('rejects sparse arrays and custom or symbol array fields', () => {
    const sparseCandidates = new Array(
      1,
    ) as CandidateFormulationRecord<'VALENCE'>[];
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('VALENCE', sparseCandidates),
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const candidatesWithField = [
      base(),
    ] as CandidateFormulationRecord<'VALENCE'>[] & { winner?: string };
    candidatesWithField.winner = 'c-1';
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('VALENCE', candidatesWithField),
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const candidatesWithOutOfRangeIndex = [
      base(),
    ] as CandidateFormulationRecord<'VALENCE'>[] & {
      4294967295?: string;
    };
    candidatesWithOutOfRangeIndex[4294967295] = 'winner';
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('VALENCE', candidatesWithOutOfRangeIndex),
        ),
      ),
    ).toBe('INVALID_SHAPE');

    const symbol = Symbol('score');
    const candidatesWithSymbol = [
      base(),
    ] as CandidateFormulationRecord<'VALENCE'>[] & {
      [symbol]?: number;
    };
    candidatesWithSymbol[symbol] = 1;
    expect(
      violationOf(() =>
        createCandidateComparisonArtifact(
          artifactInput('VALENCE', candidatesWithSymbol),
        ),
      ),
    ).toBe('INVALID_SHAPE');
  });
});
