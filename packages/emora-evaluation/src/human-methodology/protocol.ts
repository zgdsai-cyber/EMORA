import {
  COMPUTATIONAL_ONLY_OUTPUTS,
  ETHICS_GOVERNANCE_REQUIREMENTS,
  HUMAN_EVALUATION_OUTPUTS,
  HUMAN_MISSINGNESS_STATES,
  LEAKAGE_CONTROLS,
  OBSERVATION_FIELD_IDS,
  REQUIRED_REPRODUCIBILITY_FIELDS,
  SCIENTIFIC_BOUNDARY_STATEMENTS,
} from './contracts';
import type {
  HumanBehavioralEvaluationProtocolInput,
  ObservationFieldId,
} from './contracts';
import { createHumanBehavioralEvaluationProtocol } from './validation';

const OBSERVATION_FIELD_DESCRIPTIONS: Readonly<
  Record<ObservationFieldId, string>
> = Object.freeze({
  PARTICIPANT_PSEUDONYMOUS_ID:
    'Pseudonymous participant identifier separated from direct identity.',
  STUDY_ID: 'Governed study or collection-protocol identifier.',
  SESSION_ID: 'Identifier for one participant observation session.',
  SEQUENCE_ID: 'Identifier preserving repeated-observation sequence membership.',
  OBSERVATION_ID: 'Unique observation identifier within the governed dataset.',
  TIMESTAMP: 'Recorded observation timestamp and applicable time-zone policy.',
  EVENT_CONTEXT: 'Minimized, predefined event or observation context.',
  HUMAN_MEASUREMENT_DEFINITION:
    'Reference to the predefined human measurement definition; no instrument is selected here.',
  MEASUREMENT_SCALE_UNIT:
    'Declared bounds, direction, units, and interpretation of the recorded measure.',
  COLLECTION_METHOD_VERSION:
    'Identity and version of the governed collection method.',
  MISSINGNESS_STATE:
    'Explicit missingness state without implicit imputation or fabricated value.',
  EMORA_INPUT_REFERENCE:
    'Immutable reference to the corresponding governed EMORA input.',
  EMORA_OUTPUT_REFERENCE:
    'Immutable reference to the corresponding governed EMORA output.',
  CONSTRUCT_MAPPING_REFERENCE:
    'Reference to the predefined construct mapping used for this observation.',
  PROVENANCE:
    'Dataset, protocol, software, preprocessing, and collection provenance.',
});

const HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0_INPUT: HumanBehavioralEvaluationProtocolInput = {
  protocolId: 'emora-human-behavioral-evaluation-methodology',
  protocolVersion: '1.0.0',
  methodologyVersion: 'phase-6.15-v1',
  status: 'UNRESOLVED',
  issuedDate: '2026-09-18',
  scope: {
    targetOutputs: [...HUMAN_EVALUATION_OUTPUTS],
    excludedOutputs: [],
    computationalOnlyOutputs: [...COMPUTATIONAL_ONLY_OUTPUTS],
    deferredComponents: ['HYBRID_FUSION'],
  },
  population: {
    status: 'UNRESOLVED',
    description:
      'The target population and observation contexts require study-specific governance.',
    unresolvedReason: 'No target population or contexts are selected.',
  },
  observationSchema: {
    status: 'DEFINED',
    description:
      'Conceptual fields required for any future governed human observation record.',
    fields: OBSERVATION_FIELD_IDS.map((fieldId) => ({
      fieldId,
      required: true,
      status: 'DEFINED',
      description: OBSERVATION_FIELD_DESCRIPTIONS[fieldId],
    })),
    missingnessStates: [...HUMAN_MISSINGNESS_STATES],
    dataCollection: 'NONE_METHODOLOGY_ONLY',
  },
  constructMappings: HUMAN_EVALUATION_OUTPUTS.map((emoraOutput) =>
    emoraOutput === 'intensity'
      ? {
          mappingId: 'mapping-intensity',
          emoraOutput,
          mappingType: 'NOT_SUITABLE_FOR_HUMAN_EVALUATION',
          status: 'NOT_EVALUABLE',
          description:
            'State intensity is a computational mean and is distinct from event intensity.',
          unresolvedReason:
            'The human construct and independently justified measurement mapping are not defined.',
        }
      : {
          mappingId: `mapping-${emoraOutput}`,
          emoraOutput,
          mappingType: 'INDIRECT_INDICATOR',
          status: 'UNRESOLVED',
          description:
            'A human observation would be an indirect indicator, never direct access to internal emotional state.',
          unresolvedReason:
            'No human construct, measurement definition, scale mapping, or evidence reference is selected.',
        },
  ),
  descriptiveCriteria: [
    {
      criterionId: 'criterion-error',
      kind: 'ERROR',
      mappingIds: [],
      status: 'UNRESOLVED',
      description: 'Per-output descriptive error on demonstrably comparable scales.',
      unresolvedReason: 'Comparable measurement scales and mappings are not defined.',
    },
    {
      criterionId: 'criterion-association',
      kind: 'DESCRIPTIVE_ASSOCIATION',
      mappingIds: [],
      status: 'UNRESOLVED',
      description: 'Descriptive association for predefined paired observations.',
      unresolvedReason: 'Eligible mappings and observational units are not defined.',
    },
    {
      criterionId: 'criterion-agreement',
      kind: 'PREDEFINED_AGREEMENT',
      mappingIds: [],
      status: 'UNRESOLVED',
      description: 'Agreement only under a predefined agreement interpretation.',
      unresolvedReason: 'Agreement definition and compatible scales are not defined.',
    },
    {
      criterionId: 'criterion-directional',
      kind: 'PREDEFINED_DIRECTIONAL_CORRESPONDENCE',
      mappingIds: [],
      status: 'UNRESOLVED',
      description: 'Directional correspondence only for predefined transitions.',
      unresolvedReason: 'Transition identity and direction semantics remain undefined.',
    },
    {
      criterionId: 'criterion-temporal',
      kind: 'PREDEFINED_TEMPORAL_CORRESPONDENCE',
      mappingIds: [],
      status: 'UNRESOLVED',
      description: 'Temporal correspondence for governed repeated observations.',
      unresolvedReason: 'Observation intervals and temporal correspondence are undefined.',
    },
    {
      criterionId: 'criterion-coverage',
      kind: 'COVERAGE_MISSINGNESS_REPORTING',
      mappingIds: [],
      status: 'DEFINED',
      description: 'Report planned, observed, missing, invalid, excluded, and contributing units separately.',
      predefinedDefinition:
        'Every planned human observational unit has an explicit recorded disposition; no missing value is imputed implicitly.',
    },
  ],
  baselines: {
    status: 'UNRESOLVED',
    description: 'Future baselines are governed, predefined, and reported side by side only.',
    unresolvedReason: 'No baseline is selected or configured in Phase 6.15.',
    definitions: [],
    execution: 'NOT_IMPLEMENTED',
    comparisonInterpretation: 'DESCRIPTIVE_SIDE_BY_SIDE_ONLY',
  },
  temporalEvaluation: {
    status: 'UNRESOLVED',
    description: 'Repeated observations preserve participant and temporal structure.',
    unresolvedReason: 'Observation interval and participant aggregation policies are not defined.',
    repeatedObservationsRepresented: true,
    orderingRequired: true,
    observationIntervalsRequired: true,
    withinPersonBetweenPersonSeparated: true,
    missingObservationsExplicit: true,
    participantAggregationPredefined: true,
    statisticalModel: 'NONE',
  },
  individualDifferences: {
    status: 'UNRESOLVED',
    description: 'Population, individual patterns, and stable differences remain distinct.',
    unresolvedReason: 'Population and independent trait-measurement protocols are not defined.',
    populationLevelSeparated: true,
    individualPatternsSeparated: true,
    stableDifferencesRequireRepeatedContexts: true,
    independentTraitMeasurementRequired: true,
    emoraTraitAccuracyClaim: 'NONE',
  },
  partitioning: {
    status: 'UNRESOLVED',
    description:
      'Design and evaluation observations must be separated without participant leakage.',
    unresolvedReason:
      'Design, evaluation, and participant-level held-out partitions are not defined.',
    designEvaluationSeparated: true,
    participantLevelHeldOutWhereApplicable: true,
  },
  leakageControls: [...LEAKAGE_CONTROLS],
  falsifiabilityConditions: [
    {
      outcome: 'DESCRIPTIVE_SUPPORT',
      condition: 'Predefined construct-local descriptive criteria are met on eligible held-out observations.',
      governanceBoundary: 'Support remains scoped and does not establish scientific validity.',
      automaticDecision: false,
    },
    {
      outcome: 'MISMATCH',
      condition: 'Predefined observations reveal construct, direction, scale, context, or temporal mismatch.',
      governanceBoundary: 'Mismatch is recorded without post-hoc exclusion or automatic model change.',
      automaticDecision: false,
    },
    {
      outcome: 'PARAMETER_REVIEW',
      condition: 'A reproducible mismatch implicates a governed parameter hypothesis.',
      governanceBoundary: 'Any parameter work requires a separate gate and non-evaluation data.',
      automaticDecision: false,
    },
    {
      outcome: 'ADAPTATION_REVIEW',
      condition: 'Evidence motivates review of a documented formulation or construct mapping.',
      governanceBoundary: 'Adaptation requires separate governance and preserves prior results.',
      automaticDecision: false,
    },
    {
      outcome: 'REJECTION_REVIEW',
      condition: 'Predefined evidence reveals a material, reproducible incompatibility.',
      governanceBoundary: 'Rejection is a separate human decision, never an automated result.',
      automaticDecision: false,
    },
  ],
  reproducibility: {
    status: 'DEFINED',
    description: 'Future evaluation provenance must cover every result-affecting input and artifact.',
    requiredFields: [...REQUIRED_REPRODUCIBILITY_FIELDS],
  },
  ethicsGovernance: {
    status: 'DEFINED',
    description: 'Methodology-level human-data safeguards; not legal or regulatory advice.',
    requirements: [...ETHICS_GOVERNANCE_REQUIREMENTS],
  },
  scientificBoundary: [...SCIENTIFIC_BOUNDARY_STATEMENTS],
  unresolvedItems: [
    {
      itemId: 'unresolved-population',
      domain: 'POPULATION',
      status: 'UNRESOLVED',
      reason: 'Target population and contexts are not selected.',
    },
    {
      itemId: 'unresolved-measurements-mappings',
      domain: 'MEASUREMENT',
      status: 'UNRESOLVED',
      reason: 'No questionnaire, instrument, human construct, or scale mapping is selected.',
    },
    {
      itemId: 'not-evaluable-intensity',
      domain: 'CONSTRUCT_MAPPING',
      status: 'NOT_EVALUABLE',
      reason: 'State intensity lacks an approved human construct mapping.',
    },
    {
      itemId: 'unresolved-criteria',
      domain: 'CRITERION',
      status: 'UNRESOLVED',
      reason: 'Construct-specific descriptive criteria are not predefined.',
    },
    {
      itemId: 'unresolved-baselines',
      domain: 'BASELINE',
      status: 'UNRESOLVED',
      reason: 'Appropriate baselines are not selected.',
    },
    {
      itemId: 'unresolved-temporal-design',
      domain: 'TEMPORAL_DESIGN',
      status: 'UNRESOLVED',
      reason: 'Observation spacing and participant aggregation remain undefined.',
    },
    {
      itemId: 'unresolved-individual-differences',
      domain: 'INDIVIDUAL_DIFFERENCES',
      status: 'UNRESOLVED',
      reason: 'Independent repeated-context trait methodology is not defined.',
    },
    {
      itemId: 'unresolved-partitioning',
      domain: 'PARTITIONING',
      status: 'UNRESOLVED',
      reason: 'Design and participant-level held-out partitions are not defined.',
    },
    {
      itemId: 'unresolved-ethics-governance',
      domain: 'ETHICS_GOVERNANCE',
      status: 'UNRESOLVED',
      reason: 'Study-specific consent, retention, withdrawal, and deletion procedures require approval before collection.',
    },
  ],
};

export const EMORA_HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0 =
  createHumanBehavioralEvaluationProtocol(
    HUMAN_BEHAVIORAL_EVALUATION_PROTOCOL_1_0_0_INPUT,
  );
