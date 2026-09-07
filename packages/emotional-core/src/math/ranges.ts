import { InvalidDomainValueError } from '../errors/emotional-core-error';

function assertFiniteNumber(value: number, name: string) {
  if (!Number.isFinite(value)) {
    throw new InvalidDomainValueError(name, value, 'a finite number');
  }
}

export function validateNormalized01(value: number, name = 'value'): number {
  assertFiniteNumber(value, name);
  if (value < 0 || value > 1) {
    throw new InvalidDomainValueError(name, value, 'between 0 and 1 inclusive');
  }
  return value;
}

export function normalize01(value: number, name = 'value'): number {
  return validateNormalized01(value, name);
}

export function validateSignedNormalized(value: number, name = 'value'): number {
  assertFiniteNumber(value, name);
  if (value < -1 || value > 1) {
    throw new InvalidDomainValueError(name, value, 'between -1 and 1 inclusive');
  }
  return value;
}

export function clamp01(value: number, name = 'value'): number {
  assertFiniteNumber(value, name);
  return Math.min(1, Math.max(0, value));
}

export function clampSignedNormalized(value: number, name = 'value'): number {
  assertFiniteNumber(value, name);
  return Math.min(1, Math.max(-1, value));
}