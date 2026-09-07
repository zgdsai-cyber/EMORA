import { InvalidDomainObjectError } from '../errors/emotional-core-error';

export interface ModelParameters {
  readonly sets: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createModelParameters(input: ModelParameters): ModelParameters {
  for (const [setName, values] of Object.entries(input.sets)) {
    if (!setName) {
      throw new InvalidDomainObjectError('Model parameter sets require names.');
    }
    for (const [name, value] of Object.entries(values)) {
      if (!Number.isFinite(value)) {
        throw new InvalidDomainObjectError(`Model parameter ${setName}.${name} must be finite.`);
      }
    }
  }
  const sets = Object.fromEntries(
    Object.entries(input.sets).map(([setName, values]) => [
      setName,
      Object.freeze({ ...values }),
    ]),
  );
  return Object.freeze({
    sets: Object.freeze(sets),
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}
