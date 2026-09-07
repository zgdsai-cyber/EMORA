import type {
  EmotionalEvent,
  EmotionName,
  EmotionVector,
  ModelParameters,
  PersonalityProfile,
} from '../index';

export interface EventFeatureVector {
  readonly valence: number;
  readonly intensity: number;
  readonly relevance: number;
  readonly surprise: number;
  readonly uncertainty: number;
}

export type EmotionInfluence = Readonly<Record<EmotionName, number>>;
export type EmotionInteractionMatrix = Readonly<
  Record<EmotionName, Readonly<Record<EmotionName, number>>>
>;

export interface PersonalityModifiers {
  readonly emotionalSensitivity: number;
  readonly baselineTrust: number;
  readonly baselineAnxiety: number;
  readonly attachmentSensitivity: number;
  readonly nostalgiaSensitivity: number;
  readonly jealousySensitivity: number;
}

export interface DynamicsCalculationInput {
  readonly event: EmotionalEvent;
  readonly personalityProfile: PersonalityProfile;
  readonly currentVector: EmotionVector;
  readonly memories?: readonly import('../domain/emotional-memory').EmotionalMemory[];
  readonly modelParameters?: ModelParameters;
}
