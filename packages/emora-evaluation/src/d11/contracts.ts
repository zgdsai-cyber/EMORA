import type { D09ActiveMetric, D09Dimension } from '../d09/contracts';

export const D11_CONTRACT_VERSION = 'phase-6.16-d11-v1.0.0' as const;
export const D11_METHODOLOGY_VERSION =
  'D11 Baseline & Comparator Methodology v1.0.0' as const;

export const D11_BASELINE_KINDS = Object.freeze([
  'CONSTANT',
  'DETERMINISTIC_ABLATION',
] as const);
export type D11BaselineKind = (typeof D11_BASELINE_KINDS)[number];

export const D11_ABLATION_OPERATIONS = Object.freeze([
  'ZERO_INTERACTION_WEIGHTS',
  'ZERO_PERSONALITY_SENSITIVITY_WEIGHTS',
] as const);
export type D11AblationOperation = (typeof D11_ABLATION_OPERATIONS)[number];

export const D11_PROHIBITED_SEMANTICS = Object.freeze([
  'GROUND_TRUTH',
  'PSYCHOLOGICAL_TRUTH',
  'EMOTIONAL_TRUTH',
  'VALIDITY_CRITERION',
  'THRESHOLD',
  'SUCCESS_FAILURE_CRITERION',
  'WINNER_SELECTION',
  'RANKING',
  'SUPERIORITY_SCORE',
  'RECOMMENDATION',
] as const);

export interface D11IdentityReference {
  readonly id: string;
  readonly version: string;
  readonly hash: string;
}

export type D11ScopedValue<T> =
  | Readonly<{ readonly applicability: 'APPLICABLE'; readonly value: T }>
  | Readonly<{
      readonly applicability: 'NOT_APPLICABLE';
      readonly reason: string;
    }>;

export interface D11ScaleScope {
  readonly type:
    'INTERVAL' | 'RATIO' | 'ORDINAL_WITH_PREDEFINED_INTERVAL_INTERPRETATION';
  readonly units: string;
  readonly direction: 'HIGHER_MEANS_MORE' | 'HIGHER_MEANS_LESS';
}

export interface D11BaselineScope {
  readonly datasetIdentity: D11ScopedValue<D11DatasetIdentity>;
  readonly orderedCaseIds: D11ScopedValue<readonly string[]>;
  readonly evaluationContractIdentity: D11ScopedValue<D11EvaluationContractIdentity>;
  readonly metric: D09ActiveMetric;
  readonly targetOutput: string;
  readonly dimension: D09Dimension;
  readonly construct: D11ScopedValue<string>;
  readonly scale: D11ScaleScope;
  readonly observationUnit: string;
  readonly context: string;
  readonly modelIdentity: D11ScopedValue<D11IdentityReference>;
  readonly parameterConfigurationIdentity: D11ScopedValue<D11IdentityReference>;
}

export type D11DataRole =
  'DEVELOPMENT_TUNING' | 'HELD_OUT' | 'EXTERNAL_REFERENCE';

/**
 * The role in which a declared data source contributed to the baseline. Every
 * contribution must be classified explicitly; no value is inferred or assumed.
 */
export const D11_DERIVATION_USES = Object.freeze([
  'USED_TO_SET_VALUES',
  'USED_TO_SELECT_VALUES',
  'REFERENCE_ONLY',
] as const);
export type D11DerivationUse = (typeof D11_DERIVATION_USES)[number];

/**
 * Each definition must declare either its derivation data sources or the
 * explicit absence of derivation data. An empty data-source list is never
 * treated as evidence of independence, absence of overlap, or absence of
 * leakage.
 */
export const D11_DERIVATION_DATA_DECLARATIONS = Object.freeze([
  'DECLARED_DERIVATION_DATA',
  'DECLARED_NO_DERIVATION_DATA',
] as const);
export type D11DerivationDataDeclaration =
  (typeof D11_DERIVATION_DATA_DECLARATIONS)[number];

export interface D11DataProvenance {
  readonly role: D11DataRole;
  readonly identity: D11IdentityReference;
  readonly derivationUse: D11DerivationUse;
  readonly overlapsEvaluationData: boolean | 'UNKNOWN';
  readonly independenceEvidenceReference: string;
  /**
   * Reference to a separately authorized governance record. D11 validates only
   * that this declaration exists and is hashed; it cannot, and does not claim
   * to, verify the referenced record's existence, authorship, or chronology.
   */
  readonly removesReference: string;
}

export type D11BaselineProvenance =
  | Readonly<{
      readonly sourceReference: string;
      readonly justificationReference: string;
      readonly derivationDataAbsence: 'DECLARED_DERIVATION_DATA';
      readonly dataSources: readonly D11DataProvenance[];
    }>
  | Readonly<{
      readonly sourceReference: string;
      readonly justificationReference: string;
      readonly derivationDataAbsence: 'DECLARED_NO_DERIVATION_DATA';
      readonly basisReference: string;
      readonly dataSources: readonly D11DataProvenance[];
    }>;

export interface D11PredefinitionEvidence {
  readonly status: 'ESTABLISHED' | 'INSUFFICIENT';
  readonly evidenceReference: string;
  readonly freezeId: string;
  readonly freezeVersion: string;
  readonly declaredFrozenAt: string;
  readonly externalChronologyVerification:
    | 'DOCUMENTED_EXTERNAL_EVIDENCE'
    | 'NOT_VERIFIED_NO_EXTERNAL_TIMELINE_AUTHORITY';
}

export interface D11IndependenceEvidence {
  readonly status: 'ESTABLISHED' | 'INSUFFICIENT';
  readonly fittedOnEvaluationResults: false;
  readonly tunedOnEvaluationResults: false;
  readonly optimizedOnEvaluationResults: false;
  readonly selectedUsingEvaluationResults: false;
  readonly postResultDecision: false;
  readonly reusedEvaluationResults: false;
  readonly evaluationDataOverlap: false | 'UNKNOWN';
  readonly evidenceReference: string;
}

export interface D11ConstantConfiguration {
  readonly kind: 'CONSTANT';
  readonly targetValues: Readonly<Record<string, number>>;
}

export interface D11AblationConfiguration {
  readonly kind: 'DETERMINISTIC_ABLATION';
  readonly operation: D11AblationOperation;
  readonly lineage: Readonly<{
    readonly modelIdentity: D11IdentityReference;
    readonly parameterConfigurationIdentity: D11IdentityReference;
  }>;
  readonly preservedConfigurationHash: string;
  readonly mechanismReference: string;
}

export type D11BaselineConfiguration =
  D11ConstantConfiguration | D11AblationConfiguration;

export interface D11BaselineDefinitionInput {
  readonly baselineId: string;
  readonly baselineVersion: string;
  readonly kind: D11BaselineKind;
  readonly configuration: D11BaselineConfiguration;
  readonly scope: D11BaselineScope;
  readonly provenance: D11BaselineProvenance;
  readonly justification: string;
  readonly predefinition: D11PredefinitionEvidence;
  readonly independence: D11IndependenceEvidence;
}

export interface D11BaselineDefinitionArtifact extends D11BaselineDefinitionInput {
  readonly contractVersion: typeof D11_CONTRACT_VERSION;
  readonly methodologyVersion: typeof D11_METHODOLOGY_VERSION;
  readonly semantics: 'PREDEFINED_CONTEXTUAL_REFERENCE_ONLY';
  readonly automaticAuthority: false;
  readonly prohibitedSemantics: readonly (typeof D11_PROHIBITED_SEMANTICS)[number][];
  readonly configurationHash: string;
  readonly scopeHash: string;
  readonly baselineDefinitionHash: string;
}

export interface D11BaselineAuthorityInput {
  readonly authorityId: string;
  readonly authorityVersion: string;
  readonly decision: 'APPROVED_D11_BASELINE_DEFINITION';
  readonly approvedDefinitionHash: string;
  readonly approvalEvidenceReference: string;
  readonly approvedAt: string;
  /**
   * Must be canonically identical to the governed requirement value exported by
   * D11 (`D11_AUTHORITY_REFERENCE_REQUIREMENT`). Any caller-authored variation,
   * including a look-alike that differs only in its notes, is rejected.
   */
  readonly authorityRequirement: D11AuthorityReferenceRequirement;
}

export interface D11BaselineAuthorityArtifact extends D11BaselineAuthorityInput {
  readonly contractVersion: typeof D11_CONTRACT_VERSION;
  readonly methodologyVersion: typeof D11_METHODOLOGY_VERSION;
  readonly authorityKind: 'VERSIONED_DECLARED_GOVERNANCE_ARTIFACT';
  readonly authorityOrigin: 'SEPARATELY_ISSUED_GOVERNANCE_ARTIFACT';
  /**
   * Accurate, enforced statement: this artifact binds the exact
   * `approvedDefinitionHash` recomputed by D11, and D11 does not verify the
   * identity, standing, or chronology of the issuing governance body.
   */
  readonly callerDeclarationAloneIsAuthority: false;
  readonly externalAuthorityVerification: 'NOT_VERIFIED_NO_EXTERNAL_AUTHORITY_ADJUDICATION';
  readonly authorityHash: string;
}

/**
 * Frozen requirement that D11 compares against. It is deliberately not an
 * authority artifact: no value of this type can authorize, approve, or
 * authenticate a baseline, and no caller input can grant authority through it.
 */
export interface D11AuthorityReferenceRequirement {
  readonly requirementId: string;
  readonly requirementVersion: string;
  readonly requirementKind: 'REQUIRES_SEPARATELY_ISSUED_GOVERNANCE_DECISION';
  readonly bindingRule: 'EXACT_BASELINE_DEFINITION_HASH';
  readonly verifiedByD11: false;
  readonly adjudicatesExternalAuthority: false;
  readonly notes: string;
}

export interface D11DatasetIdentity {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly datasetHash: string;
}

export interface D11EvaluationContractIdentity {
  readonly contractVersion: string;
  readonly contractHash: string;
}

export interface D11MetricEvidence {
  readonly metric: D09ActiveMetric;
  readonly dimension: D09Dimension;
  readonly status: 'COMPUTED' | 'INVALID' | 'INSUFFICIENT_DATA' | 'UNDEFINED';
  readonly value?: number;
  readonly resultHash: string;
}

interface D11RunIdentityBaseInput {
  readonly runId: string;
  readonly effectiveConfigurationHash: string;
  readonly providerIdentity: D11IdentityReference;
  readonly parameterIdentity: D11ScopedValue<D11IdentityReference>;
  readonly toolchainIdentity: D11ScopedValue<D11IdentityReference>;
  readonly datasetIdentity: D11DatasetIdentity;
  readonly evaluationContractIdentity: D11EvaluationContractIdentity;
  readonly orderedCaseIds: readonly string[];
  readonly scope: D11BaselineScope;
  readonly metricEvidence: readonly D11MetricEvidence[];
  readonly executionTimestamp: string;
}

export interface D11CandidateRunIdentityInput extends D11RunIdentityBaseInput {
  readonly role: 'CANDIDATE';
}

export interface D11BaselineRunIdentityInput extends D11RunIdentityBaseInput {
  readonly role: 'BASELINE';
  readonly baselineDefinitionHash: string;
}

export interface D11CandidateRunIdentityArtifact extends D11CandidateRunIdentityInput {
  readonly runIdentityHash: string;
}

export interface D11BaselineRunIdentityArtifact extends D11BaselineRunIdentityInput {
  readonly runIdentityHash: string;
}

export type D11ComparisonStatus =
  'COMPARABLE' | 'NOT_COMPARABLE' | 'NOT_EVALUABLE';

export type D11ComparisonReason =
  | 'GOVERNED_PAIRING_SATISFIED'
  | 'UNAUTHORIZED_BASELINE'
  | 'INSUFFICIENT_PROVENANCE'
  | 'PREDEFINITION_NOT_ESTABLISHED'
  | 'INDEPENDENCE_NOT_ESTABLISHED'
  | 'EVALUATION_DATA_LEAKAGE'
  | 'BASELINE_DEFINITION_BINDING_MISMATCH'
  | 'BASELINE_CONFIGURATION_MISMATCH'
  | 'BASELINE_SCOPE_BINDING_MISMATCH'
  | 'ABLATION_LINEAGE_MISMATCH'
  | 'DATASET_IDENTITY_MISMATCH'
  | 'CASE_ORDER_MISMATCH'
  | 'EVALUATION_CONTRACT_MISMATCH'
  | 'METRIC_MISMATCH'
  | 'TARGET_OUTPUT_MISMATCH'
  | 'DIMENSION_MISMATCH'
  | 'CONSTRUCT_MISMATCH'
  | 'SCALE_MISMATCH'
  | 'OBSERVATION_UNIT_MISMATCH'
  | 'CONTEXT_MISMATCH'
  | 'MODEL_IDENTITY_MISMATCH'
  | 'PARAMETER_CONFIGURATION_MISMATCH'
  | 'METRIC_RESULT_NOT_EVALUABLE'
  | 'REQUIRED_INPUT_MISSING';

export interface D11ComparisonInput {
  readonly comparatorId: string;
  readonly comparatorVersion: string;
  readonly candidateRun: D11CandidateRunIdentityArtifact;
  readonly baselineDefinition: D11BaselineDefinitionArtifact;
  readonly baselineAuthority?: D11BaselineAuthorityArtifact;
  readonly baselineRun: D11BaselineRunIdentityArtifact;
}

export interface D11ComparisonArtifact {
  readonly contractVersion: typeof D11_CONTRACT_VERSION;
  readonly methodologyVersion: typeof D11_METHODOLOGY_VERSION;
  readonly comparatorId: string;
  readonly comparatorVersion: string;
  readonly status: D11ComparisonStatus;
  readonly reasons: readonly D11ComparisonReason[];
  readonly semantics: 'DESCRIPTIVE_COMPARABILITY_ONLY';
  readonly automaticDecision: false;
  readonly candidateRun: D11CandidateRunIdentityArtifact;
  readonly baselineDefinition: D11BaselineDefinitionArtifact;
  readonly baselineAuthority?: D11BaselineAuthorityArtifact;
  readonly baselineRun: D11BaselineRunIdentityArtifact;
  readonly datasetIdentity: D11DatasetIdentity;
  readonly evaluationContractIdentity: D11EvaluationContractIdentity;
  readonly comparisonHash: string;
}
