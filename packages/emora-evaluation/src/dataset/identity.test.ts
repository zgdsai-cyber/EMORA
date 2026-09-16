import { describe, expect, it } from 'vitest';

import { hashCanonical } from '../canonicalize';
import type { EvaluationCase } from '../contracts';
import { computeDatasetHash, checkDatasetIntegrity, EvaluationContractViolationError, verifyDatasetHash } from './identity';

const cases: EvaluationCase[] = [
  { caseId: 'c-1', datasetId: 'd', input: { a: 1 }, referenceAnnotation: { annotationType: 'EXACT_VECTOR', targetValues: { joy: 0.5 } } },
];

const identity = { datasetId: 'd', datasetVersion: '1.0.0', referenceType: 'SYNTHETIC_ORACLE' as const, cases };

describe('dataset identity (MDS v1.0 §13)', () => {
  it('hashes exactly { datasetId, datasetVersion, referenceType, cases } with the existing canonical mechanism', () => {
    expect(computeDatasetHash(identity)).toBe(hashCanonical({
      datasetId: 'd',
      datasetVersion: '1.0.0',
      referenceType: 'SYNTHETIC_ORACLE',
      cases,
    }));
  });

  it('ignores descriptive fields outside the identity object', () => {
    const withExtras = { ...identity, title: 'x', description: 'y', role: 'DESIGN', provenanceMetadata: { z: 1 }, casesCount: 1 };
    expect(computeDatasetHash(withExtras)).toBe(computeDatasetHash(identity));
  });

  it('is deterministic and independent of key insertion order', () => {
    const reordered = { cases, referenceType: 'SYNTHETIC_ORACLE' as const, datasetVersion: '1.0.0', datasetId: 'd' };
    expect(computeDatasetHash(identity)).toBe(computeDatasetHash(reordered));
    expect(computeDatasetHash(identity)).toBe(computeDatasetHash(identity));
  });

  it('changes when any identity field or case content changes', () => {
    const base = computeDatasetHash(identity);
    expect(computeDatasetHash({ ...identity, datasetVersion: '1.0.1' })).not.toBe(base);
    expect(computeDatasetHash({ ...identity, referenceType: 'EXPERT_DESIGN' })).not.toBe(base);
    expect(computeDatasetHash({
      ...identity,
      cases: [{ ...cases[0], referenceAnnotation: { annotationType: 'EXACT_VECTOR', targetValues: { joy: 0.6 } } }],
    })).not.toBe(base);
  });

  it('verifies a claimed hash and rejects a mismatch', () => {
    expect(verifyDatasetHash({ ...identity, datasetHash: computeDatasetHash(identity) })).toBe(true);
    expect(verifyDatasetHash({ ...identity, datasetHash: 'claimed-but-wrong' })).toBe(false);
  });

  it('exposes the violation code on the contract violation error', () => {
    const error = new EvaluationContractViolationError('DATASET_HASH_MISMATCH', 'mismatch');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('EvaluationContractViolationError');
    expect(error.violation).toBe('DATASET_HASH_MISMATCH');
  });
});

describe('checkDatasetIntegrity (Phase 6.7)', () => {
  const base = { datasetId: 'd', casesCount: 1, cases, role: 'DESIGN' as const, heldOutParameterVersionIds: undefined };

  it('passes when casesCount matches and no held-out rule applies', () => {
    expect(checkDatasetIntegrity(base, 'pv-1')).toBeUndefined();
    expect(checkDatasetIntegrity(base, undefined)).toBeUndefined();
  });

  it('reports CASES_COUNT_MISMATCH without repairing the value', () => {
    const failure = checkDatasetIntegrity({ ...base, casesCount: 2 }, undefined);
    expect(failure?.violation).toBe('CASES_COUNT_MISMATCH');
    expect(failure?.message).toContain('casesCount=2');
  });

  it('applies the held-out rule only to HELD_OUT datasets that declare a list and receive a parameter version', () => {
    const heldOut = { ...base, role: 'HELD_OUT' as const, heldOutParameterVersionIds: ['pv-1', 'pv-2'] };
    expect(checkDatasetIntegrity(heldOut, 'pv-2')).toBeUndefined();
    expect(checkDatasetIntegrity(heldOut, 'pv-9')?.violation).toBe('HELD_OUT_PARAMETER_VERSION_MISMATCH');
    expect(checkDatasetIntegrity(heldOut, undefined)).toBeUndefined();
    expect(checkDatasetIntegrity({ ...heldOut, heldOutParameterVersionIds: undefined }, 'pv-9')).toBeUndefined();
    expect(checkDatasetIntegrity({ ...heldOut, role: 'DESIGN' }, 'pv-9')).toBeUndefined();
  });

  it('checks casesCount before the held-out rule', () => {
    const failure = checkDatasetIntegrity({ ...base, casesCount: 0, role: 'HELD_OUT', heldOutParameterVersionIds: ['pv-1'] }, 'pv-9');
    expect(failure?.violation).toBe('CASES_COUNT_MISMATCH');
  });
});
