import type { MetricResult } from '../contracts';
import type {
  D09ActiveMetric,
  D09Dimension,
  D09ScaleDirection,
  D09ScaleType,
  D09TemporalRelationship,
} from '../d09/contracts';

export const D10_CONTRACT_VERSION = 'phase-6.16-d10-v1.0.0' as const;
export const D10_METHODOLOGY_STATUS = 'D10_METHODOLOGY_RESOLVED' as const;

export const D10_THRESHOLD_DEFINITION =
  'A predefined, scope-bound comparison or interpretation rule applied to a specified descriptive metric under explicitly documented methodological, measurement, contextual, temporal, denominator, and provenance conditions.' as const;

export const D10_PROHIBITED_CLAIMS = Object.freeze([
  'PSYCHOLOGICAL_VALIDITY',
  'EMOTIONAL_TRUTH',
  'EMOTION_DETECTION',
  'CAUSALITY',
  'PREDICTION',
  'CALIBRATION',
  'SCIENTIFIC_VALIDITY',
  'SUPERIORITY',
  'SCIENTIFIC_SUCCESS',
] as const);

export type D10ThresholdExistenceStatus =
  'NO_THRESHOLD_DEFINED' | 'PREDEFINED_SCOPE_BOUND_RULE';

export type D10ThresholdApplicabilityStatus =
  | 'NO_THRESHOLD_DEFINED'
  | 'NOT_APPLICABLE_UNAUTHORIZED_THRESHOLD'
  | 'NOT_APPLICABLE_SCOPE_MISMATCH'
  | 'NOT_EVALUABLE_METRIC_STATUS';

export type D10MetricComputationStatus = MetricResult['status'];

export interface D10InstrumentScope {
  readonly instrumentId: string;
  readonly instrumentVersion: string;
  readonly language: string;
}

export interface D10ScaleScope {
  readonly measurementUnit: string;
  readonly scaleType: D09ScaleType;
  readonly scaleDirection: D09ScaleDirection;
}

export interface D10ThresholdScope {
  readonly metric: D09ActiveMetric;
  readonly dimension: D09Dimension;
  readonly construct: string;
  readonly pairedHumanIndicator: string;
  readonly instrument: D10InstrumentScope;
  readonly scale: D10ScaleScope;
  readonly population: string;
  readonly context: string;
  readonly temporalRelationship: D09TemporalRelationship;
  readonly transformationReference: string;
  readonly denominatorMissingnessRuleReference: string;
  readonly exclusionsReference: string;
}

export type D10DerivationDataProvenance =
  | Readonly<{ readonly role: 'DECLARED_NO_DERIVATION_DATA' }>
  | Readonly<{
      readonly role: 'DECLARED_INDEPENDENT_DERIVATION_DATA';
      readonly identity: Readonly<{
        readonly dataId: string;
        readonly dataVersion: string;
        readonly dataHash: string;
      }>;
    }>;

export interface D10ThresholdProvenance {
  readonly justificationSourceReference: string;
  readonly derivationData: D10DerivationDataProvenance;
  readonly methodologyVersion: string;
  readonly configurationVersion: string;
  readonly emoraParameterVersion: string;
  readonly emoraEquationVersion: string;
}

export interface D10ThresholdGovernanceDeclaration {
  readonly declaredResultIndependent: true;
  readonly declaredThresholdFrozenBeforeResults: true;
  readonly declaredDerivationProcedureFrozenBeforeResults: true;
}

export interface D10ThresholdGovernance extends D10ThresholdGovernanceDeclaration {
  readonly automaticTransfer: false;
  readonly automaticDecision: false;
  readonly externalChronologyVerification: 'NOT_VERIFIED_NO_EXTERNAL_TIMELINE_AUTHORITY';
}

export interface D10ThresholdRuleReference {
  readonly kind: 'SCOPED_DESCRIPTIVE_INTERPRETATION_REFERENCE';
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly declaredRuleContentHash: string;
}

export interface D10ThresholdFreeze {
  readonly freezeVersion: string;
  readonly declaredFrozenAt: string;
}

export interface D10ThresholdDefinitionInput {
  readonly thresholdId: string;
  readonly thresholdVersion: string;
  readonly rule: D10ThresholdRuleReference;
  readonly scope: D10ThresholdScope;
  readonly provenance: D10ThresholdProvenance;
  readonly governance: D10ThresholdGovernanceDeclaration;
  readonly freeze: D10ThresholdFreeze;
}

export interface D10ThresholdDefinitionArtifact extends Omit<
  D10ThresholdDefinitionInput,
  'governance'
> {
  readonly governance: D10ThresholdGovernance;
  readonly authority: 'UNAUTHORIZED_FUTURE_THRESHOLD_PROPOSAL';
  readonly scopeHash: string;
  readonly thresholdHash: string;
}

interface D10ThresholdConfigurationBase {
  readonly contractVersion: typeof D10_CONTRACT_VERSION;
  readonly methodologyStatus: typeof D10_METHODOLOGY_STATUS;
  readonly thresholdDefinition: typeof D10_THRESHOLD_DEFINITION;
  readonly governedMetrics: readonly D09ActiveMetric[];
  readonly humanData: 'NONE';
  readonly numericalThresholds: 'NONE_DEFINED';
  readonly prohibitedClaims: readonly (typeof D10_PROHIBITED_CLAIMS)[number][];
}

export interface D10NoThresholdConfigurationInput {
  readonly status: 'NO_THRESHOLD_DEFINED';
}

export interface D10PredefinedThresholdConfigurationInput {
  readonly status: 'PREDEFINED_SCOPE_BOUND_RULE';
  readonly threshold: D10ThresholdDefinitionInput;
}

export type D10ThresholdConfigurationInput =
  D10NoThresholdConfigurationInput | D10PredefinedThresholdConfigurationInput;

export interface D10NoThresholdConfiguration
  extends D10ThresholdConfigurationBase, D10NoThresholdConfigurationInput {
  readonly configurationHash: string;
}

export interface D10PredefinedThresholdConfiguration
  extends
    D10ThresholdConfigurationBase,
    Omit<D10PredefinedThresholdConfigurationInput, 'threshold'> {
  readonly threshold: D10ThresholdDefinitionArtifact;
  readonly configurationHash: string;
}

export type D10ThresholdConfiguration =
  D10NoThresholdConfiguration | D10PredefinedThresholdConfiguration;

export interface D10ThresholdApplicationInput {
  readonly metricResult: MetricResult;
  readonly scope: D10ThresholdScope;
}

export interface D10ThresholdApplicabilityResult {
  readonly status: D10ThresholdApplicabilityStatus;
  readonly metricStatus: D10MetricComputationStatus;
  readonly metricResultHash: string;
  readonly attemptedScopeHash: string;
  readonly configurationHash: string;
  readonly thresholdId?: string;
  readonly thresholdHash?: string;
  readonly scopeHash?: string;
  readonly interpretation: 'NONE';
  readonly automaticDecision: false;
  readonly resultHash: string;
}
