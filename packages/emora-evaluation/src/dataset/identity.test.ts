import { describe, expect, it } from 'vitest';

import { hashCanonical } from '../canonicalize';
import type { EvaluationCase } from '../contracts';
import { computeDatasetHash, EvaluationContractViolationError, verifyDatasetHash } from './identity';

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
