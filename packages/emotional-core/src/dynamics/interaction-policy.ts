import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import { emotionNames } from '../domain/emotion-vector';
import type { EmotionInteractionMatrix } from './types';

const nonPositiveTrustSources = ['fear', 'anger'] as const;

export function validateInteractionPolicy(
  matrix: EmotionInteractionMatrix,
): EmotionInteractionMatrix {
  if (!matrix || typeof matrix !== 'object') {
    throw new InvalidDomainObjectError('Interaction matrix must be an object.');
  }

  for (const source of Object.keys(matrix)) {
    if (!(emotionNames as readonly string[]).includes(source)) {
      throw new InvalidDomainObjectError(
        `Interaction matrix contains unknown source emotion ${source}.`,
      );
    }
  }

  for (const source of emotionNames) {
    const row = matrix[source];
    if (!row || typeof row !== 'object') {
      throw new InvalidDomainObjectError(
        `Interaction matrix is missing source emotion ${source}.`,
      );
    }
    for (const target of Object.keys(row)) {
      if (!(emotionNames as readonly string[]).includes(target)) {
        throw new InvalidDomainObjectError(
          `Interaction matrix contains unknown target emotion ${source}->${target}.`,
        );
      }
    }
    for (const target of emotionNames) {
      if (!Object.prototype.hasOwnProperty.call(row, target)) {
        throw new InvalidDomainObjectError(
          `Interaction matrix is missing target emotion ${source}->${target}.`,
        );
      }
      const value = row[target];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 1) {
        throw new InvalidDomainObjectError(
          `Interaction matrix value ${source}->${target} must be a finite number between -1 and 1.`,
        );
      }
    }
  }

  for (const source of nonPositiveTrustSources) {
    if (matrix[source].trust > 0) {
      throw new InvalidDomainObjectError(
        `Interaction policy forbids positive ${source} to trust influence.`,
      );
    }
  }

  return matrix;
}
