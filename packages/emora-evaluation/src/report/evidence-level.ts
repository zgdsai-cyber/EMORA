import type { DatasetRole, EvaluationEvidenceLevel, ReferenceType } from '../contracts';

export type EvidenceLevelInput =
  | Readonly<{ readonly kind: 'L1' }>
  | Readonly<{ readonly kind: 'L2'; readonly referenceType: ReferenceType; readonly datasetRole: DatasetRole }>;

/**
 * Phase 6.7 descriptive classification from authorized metadata only. Never
 * reads metric values, execution status, or results. Returns undefined (fail
 * closed) for HUMAN_ANNOTATED + HELD_OUT because the MDS L3 preconditions are
 * deferred; no L3 value is ever produced.
 */
export function classifyEvidenceLevel(input: EvidenceLevelInput): EvaluationEvidenceLevel | undefined {
  if (input.kind === 'L1') return 'L1_STRUCTURAL';
  switch (input.referenceType) {
    case 'SYNTHETIC_ORACLE': return 'L2_SYNTHETIC';
    case 'EXPERT_DESIGN':
    case 'BASELINE_AGREEMENT': return 'L2_REFERENCE';
    case 'HUMAN_ANNOTATED': return input.datasetRole === 'HELD_OUT' ? undefined : 'L2_HUMAN_NOT_HELD_OUT';
  }
}
