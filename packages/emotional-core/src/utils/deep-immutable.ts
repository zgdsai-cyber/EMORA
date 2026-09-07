export function deepCloneAndFreeze<T>(value: T): T {
  const seen = new WeakMap<object, unknown>();

  function clone(input: unknown): unknown {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input !== 'object') {
      if (typeof input === 'function') {
        throw new TypeError('deepCloneAndFreeze does not support functions.');
      }
      return input;
    }

    const existing = seen.get(input);
    if (existing) {
      return existing;
    }

    if (Array.isArray(input)) {
      const output: unknown[] = [];
      seen.set(input, output);
      for (const item of input) {
        output.push(clone(item));
      }
      return Object.freeze(output);
    }

    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('deepCloneAndFreeze only supports plain objects and arrays.');
    }

    const output: Record<string, unknown> = {};
    seen.set(input, output);
    for (const [key, nestedValue] of Object.entries(input)) {
      output[key] = clone(nestedValue);
    }
    return Object.freeze(output);
  }

  return clone(value) as T;
}
