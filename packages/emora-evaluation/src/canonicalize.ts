import { createHash } from 'node:crypto';

export function canonicalize(value: unknown): string {
  if (value === undefined) return '{"$undefined":true}';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Cannot canonicalize non-finite values.');
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    return `{"$bigint":${JSON.stringify(value.toString())}}`;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new TypeError('Cannot canonicalize Date, Map, or Set values.');
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`).join(',')}}`;
  }
  throw new TypeError('Cannot canonicalize unsupported values.');
}

export function hashCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}
