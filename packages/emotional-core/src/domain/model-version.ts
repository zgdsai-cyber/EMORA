import { InvalidDomainObjectError } from '../errors/emotional-core-error';

export interface ModelVersion {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createModelVersion(input: ModelVersion): ModelVersion {
  if (!input.id || !input.name || !input.version) {
    throw new InvalidDomainObjectError('Model version requires id, name, and version.');
  }
  return Object.freeze({
    ...input,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}
