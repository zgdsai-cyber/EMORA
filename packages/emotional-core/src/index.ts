export type NormalizedValue = number;

export type EmotionName =
  | 'love'
  | 'fear'
  | 'nostalgia'
  | 'jealousy'
  | 'trust'
  | 'anger'
  | 'joy';

export interface EmotionVector {
  readonly love: NormalizedValue;
  readonly fear: NormalizedValue;
  readonly nostalgia: NormalizedValue;
  readonly jealousy: NormalizedValue;
  readonly trust: NormalizedValue;
  readonly anger: NormalizedValue;
  readonly joy: NormalizedValue;
  readonly valence: NormalizedValue;
  readonly arousal: NormalizedValue;
  readonly intensity: NormalizedValue;
  readonly confidence: NormalizedValue;
}

export interface EmotionalState {
  readonly vector: EmotionVector;
  readonly observedAt: string;
  readonly modelVersion: ModelVersion;
  readonly sourceEventIds: readonly string[];
}

export interface EmotionalEvent {
  readonly id: string;
  readonly subjectId: string;
  readonly occurredAt: string;
  readonly type: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface PersonalityProfile {
  readonly id: string;
  readonly subjectId: string;
  readonly traits: Readonly<Record<string, NormalizedValue>>;
  readonly version: string;
}

export interface EmotionalMemory {
  readonly id: string;
  readonly subjectId: string;
  readonly createdAt: string;
  readonly salience: NormalizedValue;
  readonly eventIds: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface EmotionPrediction {
  readonly state: EmotionalState;
  readonly horizonSeconds: number;
  readonly provider: PredictionProvider;
  readonly generatedAt: string;
}

export interface ModelParameters {
  readonly values: Readonly<Record<string, number>>;
  readonly version: ModelVersion;
}

export interface ModelVersion {
  readonly name: string;
  readonly revision: string;
}

export interface PredictionProvider {
  readonly name: string;
  readonly version: string;
  readonly kind: 'rules' | 'statistical' | 'machine-learning' | 'hybrid';
}
