import { describe, expect, it } from 'vitest';

import { TransitionError } from './errors';
import {
  MAX_CONTEXT_DEPTH,
  MAX_CONTEXT_KEYS,
  MAX_CONTEXT_STRING_LENGTH,
  parseIdempotencyKey,
  parseTransitionRequest,
  serializedContextBytes,
} from './validation';

const VALID = {
  valence: 0,
  intensity: 0.5,
  relevance: 0.5,
  surprise: 0,
  uncertainty: 0,
};

function violationOf(action: () => unknown): {
  code?: string;
  status?: number;
} {
  try {
    action();
    return {};
  } catch (error) {
    if (error instanceof TransitionError) {
      return { code: error.code, status: error.status };
    }
    throw error;
  }
}

const invalid = { code: 'invalid_input', status: 400 };

/**
 * Builds a structurally valid context whose serialized UTF-8 byte length is
 * exactly `target` bytes. Strings stay within MAX_CONTEXT_STRING_LENGTH and the
 * total key count stays within MAX_CONTEXT_KEYS, so the size rule is the only
 * rule under test.
 */
function contextOfExactSerializedBytes(target: number): Record<string, string> {
  const result: Record<string, string> = {};
  let index = 0;
  while (index < MAX_CONTEXT_KEYS) {
    const key = `key${index}`;
    const candidate = {
      ...result,
      [key]: 'x'.repeat(MAX_CONTEXT_STRING_LENGTH),
    };
    if (serializedContextBytes(candidate) > target) break;
    result[key] = 'x'.repeat(MAX_CONTEXT_STRING_LENGTH);
    index += 1;
  }

  const shortfall = target - serializedContextBytes(result);
  if (shortfall > 0) {
    const key = `key${index}`;
    const overhead =
      serializedContextBytes({ ...result, [key]: '' }) -
      serializedContextBytes(result);
    const valueLength = shortfall - overhead;
    if (
      index >= MAX_CONTEXT_KEYS ||
      valueLength < 0 ||
      valueLength > MAX_CONTEXT_STRING_LENGTH
    ) {
      throw new Error(`Cannot build an exact ${target}-byte context.`);
    }
    result[key] = 'x'.repeat(valueLength);
  }

  if (serializedContextBytes(result) !== target) {
    throw new Error(`Context is not exactly ${target} bytes.`);
  }
  return result;
}

describe('Slice 1 transport validation', () => {
  it('accepts the required event features without adding implicit fields', () => {
    const parsed = parseTransitionRequest({ ...VALID });
    expect(parsed).toEqual(VALID);
    expect('context' in parsed).toBe(false);
    expect('timestamp' in parsed).toBe(false);
    expect('source' in parsed).toBe(false);
  });

  it('rejects unknown request fields', () => {
    for (const field of [
      'modelVersionId',
      'parameterIdentity',
      'stateId',
      'eventId',
      'source',
      'memories',
      'confidence',
      'organizationId',
      'previousState',
      'alpha',
    ]) {
      expect(
        violationOf(() => parseTransitionRequest({ ...VALID, [field]: 1 })),
      ).toEqual(invalid);
    }
  });

  it('rejects out-of-range and non-finite feature values', () => {
    for (const value of [1.5, -1.5, Number.NaN, Infinity, -Infinity]) {
      expect(
        violationOf(() =>
          parseTransitionRequest({ ...VALID, intensity: value }),
        ),
      ).toEqual(invalid);
      expect(
        violationOf(() => parseTransitionRequest({ ...VALID, valence: value })),
      ).toEqual(invalid);
    }
  });

  it('rejects non-numeric values without coercing strings', () => {
    for (const value of ['0.5', '1', true, null, {}, []]) {
      expect(
        violationOf(() =>
          parseTransitionRequest({ ...VALID, relevance: value }),
        ),
      ).toEqual(invalid);
    }
  });

  it('requires every governed feature field', () => {
    for (const field of Object.keys(VALID)) {
      const body: Record<string, unknown> = { ...VALID };
      delete body[field];
      expect(violationOf(() => parseTransitionRequest(body))).toEqual(invalid);
    }
  });

  it('rejects malformed request bodies', () => {
    for (const body of [null, undefined, 'x', 4, [], true]) {
      expect(violationOf(() => parseTransitionRequest(body))).toEqual(invalid);
    }
  });
  it('accepts a bounded context of primitives and nested objects', () => {
    const parsed = parseTransitionRequest({
      ...VALID,
      context: { a: 'text', b: 2, c: true, nested: { d: 'x' } },
    });
    expect(parsed.context).toEqual({
      a: 'text',
      b: 2,
      c: true,
      nested: { d: 'x' },
    });
  });

  it('rejects context that is not a plain object', () => {
    for (const context of [[], 'text', 4, true, null]) {
      expect(
        violationOf(() => parseTransitionRequest({ ...VALID, context })),
      ).toEqual(invalid);
    }
  });

  it('rejects invalid leaf values, arrays, and non-finite numbers', () => {
    expect(
      violationOf(() =>
        parseTransitionRequest({ ...VALID, context: { a: undefined } }),
      ),
    ).toEqual(invalid);
    expect(
      violationOf(() =>
        parseTransitionRequest({ ...VALID, context: { a: [1, 2, 3] } }),
      ),
    ).toEqual(invalid);
    expect(
      violationOf(() =>
        parseTransitionRequest({ ...VALID, context: { a: Infinity } }),
      ),
    ).toEqual(invalid);
  });

  // ── Frozen bounded-context contract ──────────────────────────────────────
  // MAX_CONTEXT_SERIALIZED_BYTES = 8192 (UTF-8 bytes)
  // MAX_CONTEXT_DEPTH = 3 object levels (root = depth 1)
  // MAX_CONTEXT_KEYS = 32 total keys across the whole tree

  it('accepts a 8191-byte context and reports the exact UTF-8 byte length', () => {
    const context = contextOfExactSerializedBytes(8191);
    expect(serializedContextBytes(context)).toBe(8191);
    const parsed = parseTransitionRequest({ ...VALID, context });
    expect(serializedContextBytes(parsed.context)).toBe(8191);
  });

  it('accepts the 8192-byte boundary and rejects 8193 bytes', () => {
    // Boundary: 8192 bytes is the maximum accepted serialized size.
    const boundary = contextOfExactSerializedBytes(8192);
    expect(serializedContextBytes(boundary)).toBe(8192);
    expect(
      serializedContextBytes(
        parseTransitionRequest({ ...VALID, context: boundary }).context,
      ),
    ).toBe(8192);

    // One byte over the limit is rejected.
    const over = contextOfExactSerializedBytes(8193);
    expect(serializedContextBytes(over)).toBe(8193);
    expect(
      violationOf(() => parseTransitionRequest({ ...VALID, context: over })),
    ).toEqual(invalid);
  });

  it('counts UTF-8 bytes, not JavaScript characters', () => {
    // 12 multi-byte strings of 512 'é' characters each:
    //   bytes  = 12 x 1024 = 12288 (+ JSON syntax) > 8192  -> must be rejected
    //   chars  = 12 x  512 =  6144 (+ JSON syntax) < 8192  -> a character-count
    // implementation would wrongly accept this payload.
    const multibyte: Record<string, string> = {};
    for (let index = 0; index < 12; index += 1) {
      multibyte[`key${index}`] = 'é'.repeat(MAX_CONTEXT_STRING_LENGTH);
    }
    const asText = JSON.stringify(multibyte);
    expect(asText.length).toBeLessThan(8192);
    expect(serializedContextBytes(multibyte)).toBeGreaterThan(8192);
    expect(
      violationOf(() =>
        parseTransitionRequest({ ...VALID, context: multibyte }),
      ),
    ).toEqual(invalid);
  });

  it('accepts exactly 32 total keys across the tree and rejects 33', () => {
    const accepted: Record<string, unknown> = {};
    for (let index = 0; index < 15; index += 1)
      accepted[`root${index}`] = index;
    const acceptedGroup: Record<string, number> = {};
    for (let index = 0; index < 16; index += 1)
      acceptedGroup[`g${index}`] = index;
    accepted.group = acceptedGroup;
    // 15 root keys + "group" + 16 nested keys = 32 total keys.
    expect(
      parseTransitionRequest({ ...VALID, context: accepted }).context,
    ).toBeDefined();

    const rejected: Record<string, unknown> = {};
    for (let index = 0; index < 15; index += 1)
      rejected[`root${index}`] = index;
    const rejectedGroup: Record<string, number> = {};
    for (let index = 0; index < 17; index += 1)
      rejectedGroup[`g${index}`] = index;
    rejected.group = rejectedGroup;
    // 15 root keys + "group" + 17 nested keys = 33 total keys.
    expect(
      violationOf(() =>
        parseTransitionRequest({ ...VALID, context: rejected }),
      ),
    ).toEqual(invalid);
  });

  it('accepts three object levels and rejects a fourth', () => {
    expect(MAX_CONTEXT_DEPTH).toBe(3);

    // root (depth 1) → a (depth 2) → b (depth 3): accepted.
    expect(
      parseTransitionRequest({
        ...VALID,
        context: { a: { b: { c: 1 } } },
      }).context,
    ).toEqual({ a: { b: { c: 1 } } });

    // root (depth 1) → a (2) → b (3) → c (4): rejected.
    expect(
      violationOf(() =>
        parseTransitionRequest({
          ...VALID,
          context: { a: { b: { c: { d: 1 } } } },
        }),
      ),
    ).toEqual(invalid);
  });

  it('accepts string, number, and boolean leaves and rejects other leaf types', () => {
    const accepted = parseTransitionRequest({
      ...VALID,
      context: { text: 'value', count: 3, flag: true, negative: -12.5 },
    });
    expect(accepted.context).toEqual({
      text: 'value',
      count: 3,
      flag: true,
      negative: -12.5,
    });

    for (const leaf of [
      null,
      undefined,
      [1],
      [],
      () => 1,
      new Date(),
      new Map(),
      Symbol('x'),
      1n,
    ]) {
      expect(
        violationOf(() =>
          parseTransitionRequest({ ...VALID, context: { leaf } }),
        ),
      ).toEqual(invalid);
    }

    for (const value of [Number.NaN, Infinity, -Infinity]) {
      expect(
        violationOf(() =>
          parseTransitionRequest({ ...VALID, context: { value } }),
        ),
      ).toEqual(invalid);
    }
  });

  it('rejects oversized and excessively long context content', () => {
    expect(
      violationOf(() =>
        parseTransitionRequest({
          ...VALID,
          context: { text: 'x'.repeat(4096), more: 'y'.repeat(4096) },
        }),
      ),
    ).toEqual(invalid);
    expect(
      violationOf(() =>
        parseTransitionRequest({
          ...VALID,
          context: { text: 'x'.repeat(513) },
        }),
      ),
    ).toEqual(invalid);
  });

  it('normalizes a supplied timestamp and rejects unparseable values', () => {
    const parsed = parseTransitionRequest({
      ...VALID,
      timestamp: '2026-09-22T10:00:00+02:00',
    });
    expect(parsed.timestamp).toBe('2026-09-22T08:00:00.000Z');

    for (const timestamp of ['not-a-date', '', '  ', 123, null]) {
      expect(
        violationOf(() => parseTransitionRequest({ ...VALID, timestamp })),
      ).toEqual(invalid);
    }
  });

  it('requires a well-formed Idempotency-Key', () => {
    expect(parseIdempotencyKey('12345678')).toBe('12345678');
    expect(parseIdempotencyKey('a'.repeat(128))).toBe('a'.repeat(128));
    expect(parseIdempotencyKey(crypto.randomUUID())).toHaveLength(36);

    for (const key of [
      null,
      '',
      'short',
      'a'.repeat(129),
      'has space\n',
      'tab\tkey',
    ]) {
      expect(violationOf(() => parseIdempotencyKey(key))).toEqual({
        code: 'idempotency_key_required',
        status: 400,
      });
    }
  });
});
