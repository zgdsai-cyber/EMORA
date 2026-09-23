import { createHash } from 'node:crypto';

/**
 * Private Slice 1 canonicalization for the idempotency request digest. Kept
 * local (no shared package, no evaluation import) and deliberately minimal:
 * the accepted request contains only JSON primitives, arrays, and plain objects.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Cannot canonicalize non-finite numbers.');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
      .join(',')}}`;
  }
  throw new TypeError('Cannot canonicalize unsupported values.');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashCanonical(value: unknown): string {
  return sha256Hex(canonicalize(value));
}
