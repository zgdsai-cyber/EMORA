import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { computeDatasetHash } from './dataset/identity';
import { classifyDimension, DIMENSION_REGISTRY } from './dimensions/registry';
import type { EvaluationDataset } from './contracts';

const fixturePath = new URL(
  '../fixtures/phase-6.10-synthetic-reference.v1.json',
  import.meta.url,
);

function loadFixture(): EvaluationDataset {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as EvaluationDataset;
}

describe('Phase 6.10 synthetic reference corpus v1', () => {
  it('is a small deterministic EXPERT_DESIGN corpus with explicit case purposes', () => {
    const first = loadFixture();
    const second = loadFixture();

    expect(first).toEqual(second);
    expect(first.referenceType).toBe('EXPERT_DESIGN');
    expect(first.role).toBe('DESIGN');
    expect(first.generatorProvenance).toBeUndefined();
    expect(first.cases.length).toBeLessThanOrEqual(7);
    expect(first.casesCount).toBe(first.cases.length);

    const caseIds = first.cases.map((evaluationCase) => evaluationCase.caseId);
    expect(new Set(caseIds).size).toBe(caseIds.length);
    expect(caseIds).toEqual([
      'neutral-low-impact',
      'positive-event',
      'negative-event',
      'low-surprise',
      'high-surprise',
      'standard-personality',
      'high-sensitivity-personality',
    ]);

    for (const evaluationCase of first.cases) {
      const annotation = evaluationCase.referenceAnnotation;
      expect(annotation.annotationType).toBe('EXACT_VECTOR');
      expect(annotation.metadata?.purpose).toEqual(expect.any(String));
      const excludedDimensions = annotation.metadata?.excludedDimensions;
      expect(Array.isArray(excludedDimensions)).toBe(true);
      const targetDimensions = Object.keys(annotation.targetValues);
      const allDimensions = [
        ...targetDimensions,
        ...(excludedDimensions as string[]),
      ];
      expect(new Set(allDimensions).size).toBe(DIMENSION_REGISTRY.length);
      expect(allDimensions.sort()).toEqual(
        DIMENSION_REGISTRY.map((definition) => definition.dimensionId).sort(),
      );

      for (const dimension of targetDimensions) {
        const definition = classifyDimension(dimension);
        const value = annotation.targetValues[dimension];
        expect(definition?.behavioralTarget).toBe(true);
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value as number)).toBe(true);
        expect(value as number).toBeGreaterThanOrEqual(definition!.range[0]);
        expect(value as number).toBeLessThanOrEqual(definition!.range[1]);
      }
    }
  });

  it('matches the frozen content hash and excludes metadata from identity', () => {
    const fixture = loadFixture();
    expect(fixture.datasetHash).toBe(computeDatasetHash(fixture));

    const metadataChanged = {
      ...fixture,
      title: 'Changed descriptive title',
      description: 'Changed descriptive description',
      provenanceMetadata: { changed: true },
      generatorProvenance: {
        generatorId: 'hypothetical-metadata-only',
        generatorVersion: '0.0.0',
      },
    };
    expect(computeDatasetHash(metadataChanged)).toBe(fixture.datasetHash);

    const contentChanged = {
      ...fixture,
      cases: fixture.cases.map((evaluationCase, index) =>
        index === 0
          ? {
              ...evaluationCase,
              referenceAnnotation: {
                ...evaluationCase.referenceAnnotation,
                targetValues: {
                  ...evaluationCase.referenceAnnotation.targetValues,
                  valence: 0.1,
                },
              },
            }
          : evaluationCase,
      ),
    };
    expect(computeDatasetHash(contentChanged)).not.toBe(fixture.datasetHash);
  });
});
