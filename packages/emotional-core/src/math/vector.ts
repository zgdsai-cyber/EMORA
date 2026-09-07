import { validateEmotionVector } from '../domain/emotion-vector';
import type { EmotionVector } from '../domain/emotion-vector';
import { emotionNames } from '../domain/emotion-vector';

export function emotionVectorDistance(left: EmotionVector, right: EmotionVector): number {
  validateEmotionVector(left);
  validateEmotionVector(right);
  return Math.sqrt(
    emotionNames.reduce((sum, emotion) => sum + (left[emotion] - right[emotion]) ** 2, 0),
  );
}
