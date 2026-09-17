import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeterministicEmotionalDynamicsProvider } from '@emora/emotional-core';

import { computeDatasetHash } from './dataset/identity';
import { runBehavioralEvaluation } from './execution/runner';
import type { EvaluationDataset, EvaluationRequest } from './contracts';

const fixturePath = fileURLToPath(
  new URL('../fixtures/phase-6.9-comparator.synthetic.json', import.meta.url),
);

describe('Phase 6.9 synthetic comparator artifact', () => {
  it('has stable identity, generator provenance, and executes through the existing runner', () => {
    const artifact = JSON.parse(
      readFileSync(fixturePath, 'utf8'),
    ) as EvaluationDataset;
    expect(artifact.referenceType).toBe('EXPERT_DESIGN');
    expect(artifact.generatorProvenance?.generatorId).toBe(
      'phase-6.9-hand-authored-fixture',
    );
    expect(artifact.generatorProvenance?.seed).toBeUndefined();
    expect(artifact.datasetHash).toBe(computeDatasetHash(artifact));

    const request: EvaluationRequest = {
      dataset: artifact,
      engine: {
        provider: new DeterministicEmotionalDynamicsProvider(),
        runtimeContract: 'phase-6.9-fixture-runtime',
        engineVersion: '1.0.0',
        engineCommit: '452a13f',
      },
      parameterVersionId: 'phase-6.9-fixture-parameter',
      parameterVersionHash: 'phase-6.9-fixture-parameter-hash',
      evaluationContractVersion: 'phase-6.9-fixture-contract',
      configurationHash: 'phase-6.9-fixture-config',
    };
    const run = runBehavioralEvaluation(request, {
      runId: 'phase-6.9-fixture-run',
      executionTimestamp: '2026-09-16T00:00:00.000Z',
    });

    expect(run.datasetIdentity.datasetHash).toBe(artifact.datasetHash);
    expect(run.caseResults).toHaveLength(artifact.cases.length);
  });
});
