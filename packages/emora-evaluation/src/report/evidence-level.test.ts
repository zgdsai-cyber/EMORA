import { describe, expect, it } from 'vitest';

import { classifyEvidenceLevel } from './evidence-level';

describe('classifyEvidenceLevel (Phase 6.7, descriptive only)', () => {
  it('classifies L1 as L1_STRUCTURAL', () => {
    expect(classifyEvidenceLevel({ kind: 'L1' })).toBe('L1_STRUCTURAL');
  });

  it.each([
    ['SYNTHETIC_ORACLE', 'DESIGN', 'L2_SYNTHETIC'],
    ['SYNTHETIC_ORACLE', 'HELD_OUT', 'L2_SYNTHETIC'],
    ['EXPERT_DESIGN', 'DESIGN', 'L2_REFERENCE'],
    ['EXPERT_DESIGN', 'HELD_OUT', 'L2_REFERENCE'],
    ['BASELINE_AGREEMENT', 'DESIGN', 'L2_REFERENCE'],
    ['HUMAN_ANNOTATED', 'DESIGN', 'L2_HUMAN_NOT_HELD_OUT'],
  ] as const)('classifies %s / %s as %s', (referenceType, datasetRole, expected) => {
    expect(classifyEvidenceLevel({ kind: 'L2', referenceType, datasetRole })).toBe(expected);
  });

  it('fails closed for HUMAN_ANNOTATED + HELD_OUT and never returns an L3 value', () => {
    const level = classifyEvidenceLevel({ kind: 'L2', referenceType: 'HUMAN_ANNOTATED', datasetRole: 'HELD_OUT' });
    expect(level).toBeUndefined();
  });

  it('is deterministic', () => {
    const input = { kind: 'L2', referenceType: 'EXPERT_DESIGN', datasetRole: 'DESIGN' } as const;
    expect(classifyEvidenceLevel(input)).toBe(classifyEvidenceLevel(input));
  });
});
