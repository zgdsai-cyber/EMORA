import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import { validateNormalized01 } from './ranges';

export function normalizeConfidence(value: number): number {
  return validateNormalized01(value, 'confidence');
}

export function combineIndependentConfidence(values: readonly number[]): number {
  return values.reduce((combined, value, index) => {
    validateNormalized01(value, `confidence[${index}]`);
    return combined * value;
  }, 1);
}

export function weightedConfidence(
  values: readonly { readonly confidence: number; readonly weight: number }[],
): number {
  if (values.length === 0) {
    throw new InvalidDomainObjectError('At least one confidence value is required.');
  }
  let weightedTotal = 0;
  let totalWeight = 0;
  values.forEach(({ confidence, weight }, index) => {
    validateNormalized01(confidence, `confidence[${index}]`);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new InvalidDomainObjectError(`confidence weight[${index}] must be finite and non-negative.`);
    }
    weightedTotal += confidence * weight;
    totalWeight += weight;
  });
  if (totalWeight === 0) {
    throw new InvalidDomainObjectError('At least one confidence weight must be positive.');
  }
  return weightedTotal / totalWeight;
}
