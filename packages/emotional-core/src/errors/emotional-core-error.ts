export class EmotionalCoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmotionalCoreError';
  }
}

export class InvalidDomainValueError extends EmotionalCoreError {
  readonly value: unknown;

  constructor(name: string, value: unknown, expected: string) {
    super(`${name} must be ${expected}; received ${String(value)}.`);
    this.name = 'InvalidDomainValueError';
    this.value = value;
  }
}

export class InvalidDomainObjectError extends EmotionalCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDomainObjectError';
  }
}