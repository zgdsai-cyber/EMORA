import { validateNormalized01 } from '../math/ranges';
import { InvalidDomainObjectError } from '../errors/emotional-core-error';
import { validateEmotionalState } from './emotional-state';
import type { EmotionalState } from './emotional-state';

export interface EmotionalMemory {
  readonly id: string;
  readonly timestamp: string;
  readonly emotionalState: EmotionalState;
  readonly intensity: number;
  readonly importance: number;
  readonly decayRate: number;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createEmotionalMemory(input: EmotionalMemory): EmotionalMemory {
  validateEmotionalMemory(input);
  return Object.freeze({
    ...input,
    context: input.context ? Object.freeze({ ...input.context }) : undefined,
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}

export function validateEmotionalMemory(memory: EmotionalMemory): EmotionalMemory {
  if (!memory.id || Number.isNaN(Date.parse(memory.timestamp))) {
    throw new InvalidDomainObjectError('Memory requires an id and a valid timestamp.');
  }
  validateEmotionalState(memory.emotionalState);
  validateNormalized01(memory.intensity, 'memory.intensity');
  validateNormalized01(memory.importance, 'memory.importance');
  validateNormalized01(memory.decayRate, 'memory.decayRate');
  return memory;
}
